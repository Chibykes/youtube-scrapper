import { createHttpClient } from "@/network/httpClient";
import { debugDump } from "@/lib/debugDump";
import { mapWithConcurrency } from "@/lib/youtube";
import type {
  EmailStatus,
  ReacherCheckEmailOutput,
  ReacherCoreError,
  ReacherMiscDetails,
  ReacherReachable,
  ReacherResult,
  ReacherSmtpDetails,
} from "@/network/reacher/types";
import {
  nextProxy,
  nextProxyExcept,
  PROXY_POOL,
  type SocksProxy,
} from "@/network/reacher/constants";
import type { AxiosInstance } from "axios";

// Fan-out fallback / single-check concurrency (~2 jobs per SOCKS in PROXY_POOL).
const VERIFY_CONCURRENCY =
  Number(process.env.REACHER_VERIFY_CONCURRENCY) || 15;
const REQUEST_TIMEOUT_MS =
  Number(process.env.REACHER_REQUEST_TIMEOUT_MS) || 35_000;
const SINGLE_MAX_ATTEMPTS = Number(process.env.REACHER_MAX_ATTEMPTS) || 3;
const BULK_MAX_ATTEMPTS = Number(process.env.REACHER_BULK_MAX_ATTEMPTS) || 2;
const RETRY_DELAY_MS = 500;
const CHECK_PATH = "/v1/check_email";
const BULK_POLL_MS = Number(process.env.REACHER_BULK_POLL_MS) || 2_000;
const BULK_MAX_WAIT_MS =
  Number(process.env.REACHER_BULK_MAX_WAIT_MS) || 15 * 60_000;
// Default on when workers + rabbitmq are up (compose sets REACHER_USE_BULK=true).
const USE_BULK =
  (process.env.REACHER_USE_BULK ?? "true").toLowerCase() !== "false";

let cachedClient: AxiosInstance | null = null;
let cachedBaseUrl: string | null = null;

function baseUrl(): string {
  const url = process.env.REACHER_URL?.replace(/\/$/, "");
  if (!url) throw new Error("REACHER_URL is not set");
  return url;
}

function secretOrUndefined(override?: string): string | undefined {
  const secret = override?.trim() || process.env.REACHER_SECRET?.trim();
  return secret || undefined;
}

function reacherClient(): AxiosInstance {
  const url = baseUrl();
  if (!cachedClient || cachedBaseUrl !== url) {
    cachedBaseUrl = url;
    cachedClient = createHttpClient({
      baseURL: url,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });
  }
  return cachedClient;
}

function authHeaders(secret?: string): Record<string, string> {
  if (!secret) return {};
  return { "x-reacher-secret": secret };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCoreError(value: unknown): value is ReacherCoreError {
  return (
    !!value &&
    typeof value === "object" &&
    "type" in value &&
    "message" in value &&
    typeof (value as ReacherCoreError).type === "string"
  );
}

function statusFor(reachable: ReacherReachable): EmailStatus {
  if (reachable === "safe") return "valid";
  if (reachable === "invalid") return "invalid";
  return "unknown";
}

function reasonFrom(raw: ReacherCheckEmailOutput): string {
  const bits: string[] = [];

  if (isCoreError(raw.misc)) {
    bits.push(`misc_${raw.misc.type}`);
  } else {
    const misc = raw.misc as ReacherMiscDetails;
    if (misc.is_disposable) bits.push("disposable");
    if (misc.is_role_account) bits.push("role_account");
  }

  if (isCoreError(raw.smtp)) {
    bits.push(`smtp_${raw.smtp.type}`);
  } else {
    const smtp = raw.smtp as ReacherSmtpDetails;
    if (!smtp.can_connect_smtp) bits.push("smtp_unreachable");
    if (smtp.is_disabled) bits.push("disabled");
    if (smtp.has_full_inbox) bits.push("full_inbox");
    if (smtp.is_catch_all) bits.push("catch_all");
    if (!smtp.is_deliverable && raw.is_reachable === "invalid") {
      bits.push("undeliverable");
    }
  }

  if (isCoreError(raw.mx)) {
    bits.push(`mx_${raw.mx.type}`);
  } else if (!raw.mx.accepts_mail) {
    bits.push("no_mx");
  }

  if (!raw.syntax?.is_valid_syntax) bits.push("invalid_syntax");

  if (bits.length === 0) return raw.is_reachable;
  return bits.join(",");
}

function toResult(
  raw: ReacherCheckEmailOutput | undefined,
  fallbackEmail: string,
  fallbackReason?: string
): ReacherResult {
  if (!raw) {
    return {
      email: fallbackEmail,
      status: "unknown",
      reachable: "unknown",
      reason: fallbackReason ?? "request_failed",
    };
  }

  const reachable = raw.is_reachable ?? "unknown";
  return {
    email: raw.input || fallbackEmail,
    status: statusFor(reachable),
    reachable,
    reason: reasonFrom(raw),
    raw,
  };
}

function isRetryable(result: ReacherResult, strict: boolean): boolean {
  if (
    result.reachable === "safe" ||
    result.reachable === "invalid" ||
    result.reachable === "risky"
  ) {
    return false;
  }

  const reasons = result.reason.split(",");
  if (
    reasons.some(
      (r) => r === "http_404" || r === "http_401" || r === "http_403"
    )
  ) {
    return false;
  }

  if (reasons.includes("smtp_unreachable")) return true;
  if (reasons.includes("request_failed")) return true;
  if (reasons.some((r) => r.startsWith("smtp_"))) return true;
  if (strict) return false;
  return result.status === "unknown";
}

function retryDelayMs(attempt: number, result: ReacherResult): number {
  const proxyFlake = result.reason
    .split(",")
    .some((r) => /socks|timeout|unreachable|request_failed/i.test(r));
  const base = proxyFlake ? RETRY_DELAY_MS * 2 : RETRY_DELAY_MS;
  return base * attempt;
}

async function verifyEmailOnce(
  email: string,
  secretOverride?: string,
  proxy: SocksProxy = nextProxy()
): Promise<ReacherResult> {
  try {
    const secret = secretOrUndefined(secretOverride);
    const client = reacherClient();

    const res = await client
      .post<ReacherCheckEmailOutput>(
        CHECK_PATH,
        {
          to_email: email,
        },
        { headers: authHeaders(secret) }
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "request_failed";
        console.error(
          `reacher check_email failed email=${email} proxy=${proxy.host}:${proxy.port}`,
          message
        );
        return null;
      });

    if (!res || res.status >= 400) {
      return toResult(
        undefined,
        email,
        res ? `http_${res.status}` : "request_failed"
      );
    }

    return toResult(res.data, email);
  } catch (error) {
    console.error("error", error);
    return toResult(undefined, email, "request_failed");
  }
}

type VerifyOptions = {
  secretOverride?: string;
  maxAttempts?: number;
  strictRetry?: boolean;
};

/** Single address via /v1/check_email with rotating request-body proxy. */
export async function verifyEmail(
  email: string,
  secretOverrideOrOpts?: string | VerifyOptions
): Promise<ReacherResult> {
  const opts: VerifyOptions =
    typeof secretOverrideOrOpts === "string"
      ? { secretOverride: secretOverrideOrOpts }
      : secretOverrideOrOpts ?? {};

  const maxAttempts = opts.maxAttempts ?? SINGLE_MAX_ATTEMPTS;
  const strictRetry = opts.strictRetry ?? false;
  const secretOverride = opts.secretOverride;

  let proxy = nextProxy();
  let last = await verifyEmailOnce(email, secretOverride, proxy);

  for (let attempt = 2; attempt <= maxAttempts; attempt++) {
    if (!isRetryable(last, strictRetry)) return last;
    await sleep(retryDelayMs(attempt - 1, last));
    proxy = nextProxyExcept(proxy);
    last = await verifyEmailOnce(email, secretOverride, proxy);
  }

  return last;
}

type BulkJobStatus = {
  job_id: number;
  total_records: number;
  total_processed: number;
  job_status: "Running" | "Completed";
};

async function createBulkJob(
  emails: string[],
  secret?: string
): Promise<number | null> {
  const client = reacherClient();
  const res = await client
    .post<{ job_id: number }>(
      "/v1/bulk",
      { input: emails },
      { headers: authHeaders(secret), timeout: 30_000 }
    )
    .catch((err: unknown) => {
      console.error(
        "reacher bulk create failed",
        err instanceof Error ? err.message : err
      );
      return null;
    });

  if (!res || res.status >= 400 || typeof res.data?.job_id !== "number") {
    console.error("reacher bulk create rejected", res?.status, res?.data);
    return null;
  }
  return res.data.job_id;
}

async function waitForBulkJob(
  jobId: number,
  secret?: string
): Promise<BulkJobStatus | null> {
  const client = reacherClient();
  const headers = authHeaders(secret);
  const deadline = Date.now() + BULK_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const res = await client
      .get<BulkJobStatus>(`/v1/bulk/${jobId}`, {
        headers,
        timeout: 30_000,
      })
      .catch(() => null);

    if (res && res.status < 400 && res.data?.job_status === "Completed") {
      return res.data;
    }

    await sleep(BULK_POLL_MS);
  }

  console.error(
    `reacher bulk job ${jobId} timed out after ${BULK_MAX_WAIT_MS}ms`
  );
  return null;
}

async function fetchBulkResults(
  jobId: number,
  secret?: string
): Promise<ReacherCheckEmailOutput[]> {
  const client = reacherClient();
  const headers = authHeaders(secret);
  const out: ReacherCheckEmailOutput[] = [];
  const limit = 100;
  let offset = 0;

  for (;;) {
    const res = await client
      .get<{ results?: ReacherCheckEmailOutput[] | ReacherCheckEmailOutput }>(
        `/v1/bulk/${jobId}/results`,
        { headers, params: { limit, offset }, timeout: 60_000 }
      )
      .catch(() => null);

    if (!res || res.status >= 400) break;

    const raw = res.data?.results;
    const batch = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (batch.length === 0) break;
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return out;
}

/** Fan-out /v1/check_email with app-side proxy rotation (fallback). */
async function verifyEmailsFanOut(
  emails: string[],
  secretOverride?: string
): Promise<ReacherResult[]> {
  return mapWithConcurrency(
    emails,
    VERIFY_CONCURRENCY,
    async (email, index) => {
      if (index > 0 && index < VERIFY_CONCURRENCY) {
        await sleep(index * 80);
      }
      return verifyEmail(email, {
        secretOverride,
        maxAttempts: BULK_MAX_ATTEMPTS,
        strictRetry: true,
      });
    }
  );
}

/**
 * Preferred path: POST /v1/bulk → workers (each with own SOCKS) → poll → results.
 * Retries transport unknowns via check_email + rotating proxies.
 * Falls back to fan-out if bulk create fails.
 */
async function verifyEmailsViaBulk(
  emails: string[],
  secretOverride?: string
): Promise<ReacherResult[]> {
  const secret = secretOrUndefined(secretOverride);
  const jobId = await createBulkJob(emails, secret);
  if (jobId == null) {
    console.warn(
      "reacher bulk unavailable — falling back to check_email fan-out"
    );
    return verifyEmailsFanOut(emails, secretOverride);
  }

  const status = await waitForBulkJob(jobId, secret);
  if (!status) {
    console.warn(`reacher bulk job ${jobId} incomplete — fan-out remaining`);
    return verifyEmailsFanOut(emails, secretOverride);
  }

  const rawResults = await fetchBulkResults(jobId, secret);
  const byEmail = new Map(
    rawResults.map((r) => [
      (r.input || "").toLowerCase(),
      toResult(r, r.input || ""),
    ])
  );

  const ordered: ReacherResult[] = [];
  const toRetry: string[] = [];

  for (const email of emails) {
    const hit = byEmail.get(email.toLowerCase());
    if (!hit) {
      toRetry.push(email);
      ordered.push(toResult(undefined, email, "request_failed"));
      continue;
    }
    ordered.push(hit);
    if (isRetryable(hit, true)) toRetry.push(email);
  }

  if (toRetry.length > 0) {
    const retried = await verifyEmailsFanOut(toRetry, secretOverride);
    const retryMap = new Map(retried.map((r) => [r.email.toLowerCase(), r]));
    for (let i = 0; i < ordered.length; i++) {
      const again = retryMap.get(ordered[i].email.toLowerCase());
      if (again) ordered[i] = again;
    }
  }

  return ordered;
}

/**
 * Bulk verify. Default: /v1/bulk against RabbitMQ workers (one proxy each).
 * Set REACHER_USE_BULK=false to force concurrent /v1/check_email instead.
 */
export async function verifyEmailsBulk(
  emails: string[],
  secretOverride?: string
): Promise<ReacherResult[]> {
  const runId = Date.now();
  const results = USE_BULK
    ? await verifyEmailsViaBulk(emails, secretOverride)
    : await verifyEmailsFanOut(emails, secretOverride);

  await debugDump(`reacher-verify-${runId}-summary`, {
    submitted: emails.length,
    mode: USE_BULK ? "bulk" : "fanout",
    concurrency: VERIFY_CONCURRENCY,
    maxAttempts: BULK_MAX_ATTEMPTS,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    proxyPoolSize: PROXY_POOL.length,
    valid: results.filter((r) => r.status === "valid").length,
    invalid: results.filter((r) => r.status === "invalid").length,
    unknown: results.filter((r) => r.status === "unknown").length,
  });

  return results;
}
