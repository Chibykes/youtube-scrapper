import { createHttpClient } from "@/network/httpClient";
import { debugDump } from "@/lib/debugDump";
import { mapWithConcurrency } from "@/lib/youtube";
import type {
  MailsSoBatch,
  MailsSoEmail,
  MailsSoResult,
  MailsSoValidateResponse,
  MailsSoVerdict,
} from "@/network/mailsSo/types";

const BATCH_POLL_ATTEMPTS = 6;
const BATCH_POLL_INTERVAL_MS = 2000;
// mails.so silently omits already-cached emails from batch results (see
// validateEmailsBulk below), so the backfill of individually-validated
// "missing" emails needs to run at enough concurrency to finish well within
// the API route's maxDuration even when most of a large batch comes back
// missing.
const BACKFILL_CONCURRENCY = 25;

// mails.so's own guidance: a high score with a "deliverable" result
// indicates a valid, usable address. Below this we treat the result as too
// uncertain to call valid. See https://docs.mails.so/response.
const SCORE_VALID_THRESHOLD = 50;

const mailsSoApi = createHttpClient({ baseURL: "https://api.mails.so/v1" });

function apiKeyOrThrow(override: string | undefined): string {
  const key = override || process.env.MAILSO_API_KEY;
  if (!key) throw new Error("No mails.so API key provided");
  return key;
}

function authHeaders(apiKey: string): Record<string, string> {
  return { "x-mails-api-key": apiKey };
}

// mails.so's `result` is "deliverable" | "undeliverable" | "risky" |
// "unknown". The first two are unambiguous and always win. "risky"/
// "unknown" fall back to `score` as the tiebreaker.
function statusFor(result: MailsSoVerdict, score: number): EmailStatus {
  if (result === "deliverable") return "valid";
  if (result === "undeliverable") return "invalid";
  return score >= SCORE_VALID_THRESHOLD ? "valid" : "unknown";
}

type EmailStatus = "valid" | "invalid" | "unknown";

function toResult(
  raw: Partial<MailsSoEmail> | undefined,
  fallbackEmail: string
): MailsSoResult {
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

  const res = await mailsSoApi
    .get<MailsSoValidateResponse>("/validate", {
      params: { email },
      headers: authHeaders(apiKey),
    })
    .catch(() => null);

  if (!res || res.status >= 400) {
    return toResult(
      { reason: res ? `http_${res.status}` : "request_failed" },
      email
    );
  }

  return toResult(res.data?.data, email);
}

async function submitBatch(
  emails: string[],
  apiKey: string
): Promise<MailsSoBatch> {
  const res = await mailsSoApi.post<MailsSoBatch>(
    "/batch",
    { emails },
    { headers: authHeaders(apiKey) }
  );
  if (res.status >= 400)
    throw new Error(`mails.so batch submit failed (HTTP ${res.status})`);
  return res.data;
}

async function fetchBatch(id: string, apiKey: string): Promise<MailsSoBatch> {
  const res = await mailsSoApi.get<MailsSoBatch>(`/batch/${id}`, {
    headers: authHeaders(apiKey),
  });
  if (res.status >= 400)
    throw new Error(`mails.so batch fetch failed (HTTP ${res.status})`);
  return res.data;
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
  let batchId = "no-batch";

  try {
    const batchResult = await submitBatch(emails, apiKey);
    batchId = batchResult.id;
    await debugDump(`mailsso-batch-${batchId}-submit`, batchResult);
    for (let attempt = 0; attempt < BATCH_POLL_ATTEMPTS; attempt++) {
      await sleep(BATCH_POLL_INTERVAL_MS);
      const job = await fetchBatch(batchId, apiKey);
      if (!job.finished_at) continue;

      await debugDump(`mailsso-batch-${batchId}-result`, job);

      for (const raw of job.emails ?? []) {
        byEmail.set(raw.email, toResult(raw, raw.email));
      }
      break;
    }
  } catch (error) {
    console.error("Error submitting or polling batch:", error);
    // Submission or polling failed outright — every email gets backfilled below.
  }

  const fromBatch = byEmail.size;
  const missing = emails.filter((email) => !byEmail.has(email));
  let backfilled: MailsSoResult[] = [];
  if (missing.length > 0) {
    backfilled = await mapWithConcurrency(
      missing,
      BACKFILL_CONCURRENCY,
      (email) => validateEmail(email, apiKey)
    );
    for (const result of backfilled) byEmail.set(result.email, result);
    await debugDump(`mailsso-batch-${batchId}-backfilled`, backfilled);
  }

  const results = emails.map((email) => byEmail.get(email)!);
  await debugDump(`mailsso-batch-${batchId}-summary`, {
    submitted: emails.length,
    returnedByBatch: fromBatch,
    backfilled: missing.length,
    finalResults: results.length,
  });
  return results;
}
