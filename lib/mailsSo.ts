import { debugDump } from "@/lib/debugDump";
import { mapWithConcurrency } from "@/lib/youtube";

const API_BASE = "https://api.mails.so/v1";
const BATCH_POLL_ATTEMPTS = 6;
const BATCH_POLL_INTERVAL_MS = 2000;
const BACKFILL_CONCURRENCY = 5;

// mails.so's own guidance: a high score with a "deliverable" result
// indicates a valid, usable address. Below this we treat the result as too
// uncertain to call valid. See https://docs.mails.so/response.
const SCORE_VALID_THRESHOLD = 50;

/** mails.so's `result` verdict. Documented values: docs.mails.so/response. */
export type MailsSoVerdict = "deliverable" | "undeliverable" | "risky" | "unknown";

/**
 * Raw per-email result shape returned by both `GET /v1/validate` and
 * `GET /v1/batch/:id` (each entry of its `emails` array) — see
 * https://docs.mails.so/bulk.
 */
export type MailsSoEmail = {
  id: string;
  email: string;
  username: string | null;
  domain: string | null;
  mx_record: string | null;
  score: number;
  isv_format: boolean;
  isv_domain: boolean;
  isv_mx: boolean | null;
  isv_noblock: boolean;
  isv_nocatchall: boolean;
  isv_nogeneric: boolean;
  is_free: boolean;
  result: MailsSoVerdict;
  reason: string;
};

/** `POST /v1/batch` response and the shape returned by `GET /v1/batch/:id`. */
export type MailsSoBatch = {
  id: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  finished_at: string | null;
  user_id: string;
  size: number;
  emails?: MailsSoEmail[];
};

export type EmailStatus = "valid" | "invalid" | "unknown";

/** Our own valid/invalid/unknown verdict, derived from mails.so's raw result. */
export type MailsSoResult = {
  email: string;
  status: EmailStatus;
  result: MailsSoVerdict;
  reason: string;
  score: number;
  isFree: boolean | null;
  isDisposable: boolean;
  isCatchAll: boolean;
};

function apiKeyOrThrow(override: string | undefined): string {
  const key = override || process.env.MAILSO_API_KEY;
  if (!key) throw new Error("No mails.so API key provided");
  return key;
}

// mails.so's `result` is "deliverable" | "undeliverable" | "risky" |
// "unknown". The first two are unambiguous and always win. "risky"/
// "unknown" fall back to `score` as the tiebreaker.
function statusFor(result: MailsSoVerdict, score: number): EmailStatus {
  if (result === "deliverable") return "valid";
  if (result === "undeliverable") return "invalid";
  return score >= SCORE_VALID_THRESHOLD ? "valid" : "unknown";
}

function toResult(raw: Partial<MailsSoEmail> | undefined, fallbackEmail: string): MailsSoResult {
  const email = raw?.email ?? fallbackEmail;
  const result = raw?.result ?? "unknown";
  const score = typeof raw?.score === "number" ? raw.score : 0;

  return {
    email,
    status: statusFor(result, score),
    result,
    reason: raw?.reason ?? "unknown",
    score,
    isFree: raw?.is_free ?? null,
    isDisposable: raw?.isv_nogeneric === false,
    isCatchAll: raw?.isv_nocatchall === false,
  };
}

export async function validateEmail(
  email: string,
  apiKeyOverride?: string
): Promise<MailsSoResult> {
  const apiKey = apiKeyOrThrow(apiKeyOverride);
  const url = new URL(`${API_BASE}/validate`);
  url.searchParams.set("email", email);

  const res = await fetch(url, {
    headers: { "x-mails-api-key": apiKey },
    cache: "no-store",
  }).catch(() => null);

  if (!res || !res.ok) {
    return toResult({ reason: res ? `http_${res.status}` : "request_failed" }, email);
  }

  const body = (await res.json().catch(() => null)) as { data?: MailsSoEmail } | null;
  return toResult(body?.data, email);
}

async function submitBatch(emails: string[], apiKey: string): Promise<MailsSoBatch> {
  const res = await fetch(`${API_BASE}/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mails-api-key": apiKey },
    body: JSON.stringify({ emails }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`mails.so batch submit failed (HTTP ${res.status})`);
  return res.json();
}

async function fetchBatch(id: string, apiKey: string): Promise<MailsSoBatch> {
  const res = await fetch(`${API_BASE}/batch/${id}`, {
    headers: { "x-mails-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`mails.so batch fetch failed (HTTP ${res.status})`);
  return res.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validates a list of emails via mails.so's bulk batch endpoint — one job
 * for the whole list, submitted in a single request per
 * https://docs.mails.so/bulk. A batch isn't ready the instant it's
 * submitted (`finished_at` starts out null), but mails.so finishes
 * small/medium batches in ~1-2s, so this checks back a few times a couple
 * seconds apart rather than long-polling indefinitely.
 *
 * mails.so can silently omit emails it's already validated recently from
 * the batch results, so anything still missing afterward — or every email,
 * if the batch never finishes in time — is backfilled with individual
 * `/v1/validate` calls, guaranteeing a real result for every email.
 */
export async function validateEmailsBulk(
  emails: string[],
  apiKeyOverride?: string
): Promise<MailsSoResult[]> {
  const apiKey = apiKeyOrThrow(apiKeyOverride);
  const byEmail = new Map<string, MailsSoResult>();

  try {
    const batchResult = await submitBatch(emails, apiKey);
    const { id } = batchResult;
    await debugDump(`mailsso-batch-${id}-submit`, batchResult);
    for (let attempt = 0; attempt < BATCH_POLL_ATTEMPTS; attempt++) {
      await sleep(BATCH_POLL_INTERVAL_MS);
      const job = await fetchBatch(id, apiKey);
      console.log("================= FETCHED BATCH JOB ======================", job);
      await debugDump(`mailsso-batch-${id}-poll-${attempt}`, job);
      if (!job.finished_at) continue;

      for (const raw of job.emails ?? []) {
        byEmail.set(raw.email, toResult(raw, raw.email));
      }
      break;
    }
  } catch {
    // Submission or polling failed outright — every email gets backfilled below.
  }

  const missing = emails.filter((email) => !byEmail.has(email));
  if (missing.length > 0) {
    const backfilled = await mapWithConcurrency(missing, BACKFILL_CONCURRENCY, (email) =>
      validateEmail(email, apiKey)
    );
    for (const result of backfilled) byEmail.set(result.email, result);
  }

  return emails.map((email) => byEmail.get(email)!);
}
