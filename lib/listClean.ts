import { debugDump } from "@/lib/debugDump";
import { mapWithConcurrency } from "@/lib/youtube";

const API_BASE = "https://api.listclean.xyz/v1";

// listclean's documented hard limit for POST /verify/email/batch.
const MAX_BATCH_SIZE = 3000;
// Batches run as separate async jobs (list_id), so lists over MAX_BATCH_SIZE
// are split into chunks submitted CHUNK_CONCURRENCY at a time.
const CHUNK_CONCURRENCY = 3;

const LIST_POLL_ATTEMPTS = 20;
const LIST_POLL_INTERVAL_MS = 3000;

// If a chunk's job doesn't finish in time (or omits an email), that email
// gets a real-time verdict from the single-email endpoint instead.
const BACKFILL_CONCURRENCY = 25;

/** listclean's per-email verdict. See https://api.listclean.xyz. */
export type ListCleanVerdict = "clean" | "dirty" | "unknown" | "error";

/** Raw per-email record — the shape of one item from GET /verify/email/{email} and GET /downloads/json/{list_id}/{type}. */
export type ListCleanEmailRecord = ListCleanDownloadData["result"][number];

export type ListCleanJobStatus = "SUBMITTED" | "INPROCESS" | "COMPLETED";

/** GET /lists/{list_id} response data. */
export type ListCleanListInfo = {
  list_id: number;
  filename: string;
  request_time: string;
  status: ListCleanJobStatus;
  upload_id: string;
  size_in_bytes: number;
  size_for_human: string;
  allow_download: number;
  analytics: {
    summary: {
      total: string;
      duplicate: number;
      dirty: {
        count: number;
        perc: number;
      };
      clean: {
        count: number;
        perc: number;
      };
      unknown: {
        count: number;
        perc: number;
      };
    };
    dirty_summary: [
      {
        count: number;
        perc: number;
        dirty_type: string;
      }
    ];
    clean_summary: [
      {
        count: number;
        perc: number;
        clean_type: string;
      }
    ];
  };
  cost: {
    rate: {
      INR: number;
      USD: number;
    };
    cost: {
      INR: number;
      USD: number;
    };
  };
};

type ListCleanEnvelope<T> = {
  success: 0 | 1;
  message: string;
  error_code?: number;
  data: T;
};

/**
 * GET /downloads/json/{list_id}/{type} wraps its payload in a second,
 * undocumented envelope on top of the usual one — verified against a live
 * response, not just the (looser) published spec. So the full response is
 * ListCleanEnvelope<ListCleanEnvelope<ListCleanDownloadData>>.
 */
type ListCleanDownloadData = {
  queue_name: string;
  type: string;
  sub_type: string;
  total: number;
  result: {
    email: string;
    status: ListCleanVerdict;
    reason_code: string;
    reason: string;
    mx: string;
    msp: string;
    attributes: {
      EMAIL: string;
    };
  }[];
};

export type EmailStatus = "valid" | "invalid" | "unknown";

/** Our own valid/invalid/unknown verdict, derived from listclean's raw status. */
export type ListCleanResult = {
  email: string;
  status: EmailStatus;
  verdict: ListCleanVerdict;
  reason: string;
};

function apiKeyOrThrow(override: string | undefined): string {
  const key = override || process.env.LISTCLEAN_API_KEY;
  if (!key) throw new Error("No listclean API key provided");
  return key;
}

// listclean's `status` is "clean" | "dirty" | "unknown" | "error". "clean"
// and "dirty" are unambiguous; "unknown"/"error" both mean "couldn't tell",
// so both map to our own "unknown".
function statusFor(verdict: ListCleanVerdict): EmailStatus {
  if (verdict === "clean") return "valid";
  if (verdict === "dirty") return "invalid";
  return "unknown";
}

function toResult(
  raw: Partial<ListCleanEmailRecord> | undefined,
  fallbackEmail: string
): ListCleanResult {
  const email = raw?.email ?? fallbackEmail;
  const verdict = raw?.status ?? "unknown";

  return {
    email,
    status: statusFor(verdict),
    verdict,
    reason: raw?.reason ?? "unknown",
  };
}

function authHeaders(apiKey: string): HeadersInit {
  return { "X-Auth-Token": apiKey };
}

export async function verifyEmail(
  email: string,
  apiKeyOverride?: string
): Promise<ListCleanResult> {
  const apiKey = apiKeyOrThrow(apiKeyOverride);
  const url = `${API_BASE}/verify/email/${encodeURIComponent(email)}`;

  const res = await fetch(url, {
    headers: authHeaders(apiKey),
    cache: "no-store",
  }).catch(() => null);

  if (!res || !res.ok) {
    return toResult(
      {
        reason: res ? `http_${res.status}` : "request_failed",
        reason_code: res ? `${res.status}` : "request_failed",
      },
      email
    );
  }

  const body = (await res.json().catch(() => null)) as ListCleanEnvelope<
    ListCleanEmailRecord[]
  > | null;
  return toResult(body?.data?.[0], email);
}

// listclean's real response has `list_id` as a string ("370124"), despite
// the published spec claiming it's an integer — verified against a live
// response from the API playground.
async function submitBatch(emails: string[], apiKey: string): Promise<string> {
  const res = await fetch(`${API_BASE}/verify/email/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(apiKey) },
    body: JSON.stringify({ emails }),
    cache: "no-store",
  });
  if (!res.ok)
    throw new Error(`listclean batch submit failed (HTTP ${res.status})`);

  const body = (await res.json()) as ListCleanEnvelope<{
    list_id: string | number;
  }>;
  console.log("body", body);
  const listId = body.data?.list_id;
  if (listId === undefined || listId === null) {
    throw new Error("listclean batch submit response had no list_id");
  }

  return String(listId);
}

async function fetchListInfo(
  listId: string,
  apiKey: string
): Promise<ListCleanListInfo> {
  const res = await fetch(`${API_BASE}/lists/${listId}`, {
    headers: authHeaders(apiKey),
    cache: "no-store",
  });
  if (!res.ok)
    throw new Error(`listclean list fetch failed (HTTP ${res.status})`);

  const body = (await res.json()) as ListCleanEnvelope<ListCleanListInfo>;
  const info = body.data;
  if (!info) throw new Error("listclean list fetch response had no data");
  return info;
}

// type=all pulls every category (clean/dirty/unknown/error) in a single
// call, instead of one request per documented type value — which also
// avoids silently missing "error"-status emails, since the download
// endpoint's documented type enum only lists clean/dirty/unknown.
async function downloadResults(
  listId: string,
  apiKey: string
): Promise<ListCleanEmailRecord[]> {
  const res = await fetch(`${API_BASE}/downloads/json/${listId}/all`, {
    headers: authHeaders(apiKey),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`listclean download failed (HTTP ${res.status})`);
  }

  const body = (await res
    .json()
    .catch(() => null)) as ListCleanEnvelope<ListCleanDownloadData> | null;
  return body?.data?.result ?? [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Submits one chunk (<= MAX_BATCH_SIZE) as a listclean batch job and polls
 * it to completion. Never throws — a failed submit/poll/download just means
 * every email in this chunk falls through to the caller's backfill step.
 */
async function runListCleanChunk(
  emails: string[],
  apiKey: string
): Promise<Map<string, ListCleanResult>> {
  const byEmail = new Map<string, ListCleanResult>();

  try {
    const listId = await submitBatch(emails, apiKey);
    for (let attempt = 0; attempt < LIST_POLL_ATTEMPTS; attempt++) {
      await sleep(LIST_POLL_INTERVAL_MS);
      const info = await fetchListInfo(listId, apiKey);
      if (info.status !== "COMPLETED") continue;

      const records = await downloadResults(listId, apiKey);
      await debugDump(`listclean-list-${listId}-result`, { info, records });

      for (const raw of records) {
        byEmail.set(raw.email, toResult(raw, raw.email));
      }
      break;
    }
  } catch (error) {
    console.error("Error submitting or polling listclean batch:", error);
  }

  return byEmail;
}

/**
 * Verifies a list of emails via listclean's batch endpoint
 * (https://api.listclean.xyz — POST /verify/email/batch). A batch job is
 * capped at MAX_BATCH_SIZE emails, so larger lists are split into chunks
 * submitted CHUNK_CONCURRENCY at a time; each chunk is polled via
 * GET /lists/{list_id} until its status is "COMPLETED", then its per-email
 * verdicts are pulled in one call from GET /downloads/json/{list_id}/all.
 *
 * Anything still missing afterward — a chunk that never finished, or an
 * email a job omitted — is backfilled with individual
 * GET /verify/email/{email} calls, guaranteeing a real result for every
 * email regardless of chunking or job failures.
 */
export async function verifyEmailsBulk(
  emails: string[],
  apiKeyOverride?: string
): Promise<ListCleanResult[]> {
  const apiKey = apiKeyOrThrow(apiKeyOverride);
  const byEmail = new Map<string, ListCleanResult>();
  const runId = crypto.randomUUID();

  const chunks = chunk(emails, MAX_BATCH_SIZE);
  const chunkMaps = await mapWithConcurrency(
    chunks,
    CHUNK_CONCURRENCY,
    (batch) => runListCleanChunk(batch, apiKey)
  );
  for (const chunkMap of chunkMaps) {
    for (const [email, result] of chunkMap) byEmail.set(email, result);
  }

  const fromBatches = byEmail.size;
  const missing = emails.filter((email) => !byEmail.has(email));
  if (missing.length > 0) {
    const backfilled = await mapWithConcurrency(
      missing,
      BACKFILL_CONCURRENCY,
      (email) => verifyEmail(email, apiKey)
    );
    for (const result of backfilled) byEmail.set(result.email, result);
    await debugDump(`listclean-verify-${runId}-backfilled`, backfilled);
  }

  const results = emails.map((email) => byEmail.get(email)!);
  await debugDump(`listclean-verify-${runId}-summary`, {
    submitted: emails.length,
    chunks: chunks.length,
    returnedByBatches: fromBatches,
    backfilled: missing.length,
    finalResults: results.length,
  });
  return results;
}
