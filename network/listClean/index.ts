import { createHttpClient } from "@/network/httpClient";
import { debugDump } from "@/lib/debugDump";
import { mapWithConcurrency } from "@/lib/youtube";
import type {
  ListCleanDownloadData,
  ListCleanDownloadType,
  ListCleanEmailRecord,
  ListCleanEnvelope,
  ListCleanListInfo,
  ListCleanResult,
  ListCleanVerdict,
  VerifyEmailBatchData,
} from "@/network/listClean/types";

// listclean's documented hard limit for POST /verify/email/batch.
const MAX_BATCH_SIZE = 3000;
// Batches run as separate async jobs (list_id), so lists over MAX_BATCH_SIZE
// are split into chunks submitted CHUNK_CONCURRENCY at a time.
const CHUNK_CONCURRENCY = 3;

const LIST_POLL_ATTEMPTS = 20;
const LIST_POLL_INTERVAL_MS = 5000;

// If a chunk's job doesn't finish in time (or omits an email), that email
// gets a real-time verdict from the single-email endpoint instead.
const BACKFILL_CONCURRENCY = 25;

const listCleanApi = createHttpClient({
  baseURL: "https://api.listclean.xyz/v1",
});

function apiKeyOrThrow(override: string | undefined): string {
  const key = override || process.env.LISTCLEAN_API_KEY;
  if (!key) throw new Error("No listclean API key provided");
  return key;
}

// listclean's `status` is "clean" | "dirty" | "unknown" | "error". "clean"
// and "dirty" are unambiguous; "unknown"/"error" both mean "couldn't tell",
// so both map to our own "unknown".
function statusFor(verdict: ListCleanVerdict): ListCleanResult["status"] {
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

function authHeaders(apiKey: string): Record<string, string> {
  return { "X-Auth-Token": apiKey };
}

export async function verifyEmail(
  email: string,
  apiKeyOverride?: string
): Promise<ListCleanResult> {
  const apiKey = apiKeyOrThrow(apiKeyOverride);

  const res = await listCleanApi
    .get<ListCleanEnvelope<ListCleanEmailRecord>>(
      `/verify/email/${encodeURIComponent(email)}`,
      { headers: authHeaders(apiKey) }
    )
    .catch(() => null);

  if (!res || res.status >= 400) {
    return toResult(
      {
        reason: res ? `http_${res.status}` : "request_failed",
        reason_code: res ? `${res.status}` : "request_failed",
      },
      email
    );
  }

  return toResult(res.data?.data, email);
}

/**
 * POST /verify/email/batch — submits up to MAX_BATCH_SIZE emails as one
 * async job and returns its list_id, used to poll {@link getListInfo} and
 * fetch results via {@link downloadListResults}.
 */
export async function verifyEmailBatch(
  emails: string[],
  apiKeyOverride?: string
): Promise<string> {
  const apiKey = apiKeyOrThrow(apiKeyOverride);
  const res = await listCleanApi.post<ListCleanEnvelope<VerifyEmailBatchData>>(
    "/verify/email/batch",
    { emails },
    { headers: authHeaders(apiKey) }
  );
  console.log("========== VERIFY EMAIL BATCH ==========\n", res.data);
  if (res.status >= 400)
    throw new Error(`listclean batch submit failed (HTTP ${res.status})`);

  const listId = res.data.data?.list_id;
  if (listId === undefined || listId === null) {
    throw new Error("listclean batch submit response had no list_id");
  }

  return String(listId);
}

/** GET /lists/{list_id} — status and metadata for one submitted batch job. */
export async function getListInfo(
  listId: string,
  apiKeyOverride?: string
): Promise<ListCleanListInfo> {
  const apiKey = apiKeyOrThrow(apiKeyOverride);
  const res = await listCleanApi.get<ListCleanEnvelope<ListCleanListInfo>>(
    `/lists/${listId}`,
    { headers: authHeaders(apiKey) }
  );
  console.log("========== GET LIST INFO ==========\n", res.data);
  if (res.status >= 400)
    throw new Error(`listclean list fetch failed (HTTP ${res.status})`);

  const info = res.data.data;
  if (!info) throw new Error("listclean list fetch response had no data");
  return info;
}

/**
 * GET /downloads/json/{list_id}/{type} — per-email verdicts for a completed
 * batch job. Defaults to "all", listclean's own addition that pulls every
 * category (including "error") in one call instead of one request per
 * documented type value — which also avoids silently missing
 * "error"-status emails.
 */
export async function downloadListResults(
  listId: string,
  type: ListCleanDownloadType = "all",
  apiKeyOverride?: string
): Promise<ListCleanEmailRecord[]> {
  const apiKey = apiKeyOrThrow(apiKeyOverride);
  const res = await listCleanApi
    .get<ListCleanEnvelope<ListCleanDownloadData>>(
      `/downloads/json/${listId}/${type}`,
      { headers: authHeaders(apiKey) }
    )
    .catch(() => null);
  console.log("========== DOWNLOAD LIST RESULTS ==========\n", res?.data);
  if (!res || res.status >= 400) {
    throw new Error(
      `listclean download failed (HTTP ${res?.status ?? "request_failed"})`
    );
  }

  return res.data?.data?.data?.result ?? [];
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
    const listId = await verifyEmailBatch(emails, apiKey);
    for (let attempt = 0; attempt < LIST_POLL_ATTEMPTS; attempt++) {
      await sleep(LIST_POLL_INTERVAL_MS);
      const info = await getListInfo(listId, apiKey);
      if (info.status !== "COMPLETED") continue;

      await sleep(LIST_POLL_INTERVAL_MS);
      const records = await downloadListResults(listId, "all", apiKey);
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
  const runId = Date.now();

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
