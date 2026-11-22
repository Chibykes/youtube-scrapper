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
import { PROXY_HOST, PROXY_PORT } from "@/network/reacher/constants";
import type { AxiosInstance } from "axios";

// One SOCKS5 proxy collapses under high parallel Gmail SMTP (Socks5 early eof
// + 45s timeouts in Reacher logs). Keep this low; raise only with more proxies.
const VERIFY_CONCURRENCY = Number(process.env.REACHER_VERIFY_CONCURRENCY) || 4;
// Must sit above RCH__SMTP_TIMEOUT. Successful Gmail checks often take 10–35s.
const REQUEST_TIMEOUT_MS =
  Number(process.env.REACHER_REQUEST_TIMEOUT_MS) || 45_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 750;
// /v1 is what production logs successfully; /v0 is deprecated and can 404.
const CHECK_PATH = "/v1/check_email";

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
  // Self-hosted auth uses x-reacher-secret (RCH__HEADER_SECRET), not Bearer.
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

/**
 * Map Reacher confidence → our wallet/UI status.
 * - safe → valid
 * - invalid → invalid
 * - risky / unknown → unknown (risky still exists but may bounce / catch-all)
 */
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

/**
 * Retry only transient transport failures.
 * Skip: safe/invalid (done), risky (SMTP answered), hard HTTP errors (404/401).
 */
function isRetryable(result: ReacherResult): boolean {
  if (
    result.reachable === "safe" ||
    result.reachable === "invalid" ||
    result.reachable === "risky"
  ) {
    return false;
  }

  const reasons = result.reason.split(",");
  if (reasons.some((r) => r === "http_404" || r === "http_401" || r === "http_403")) {
    return false;
  }

  if (reasons.includes("smtp_unreachable")) return true;
  if (reasons.includes("request_failed")) return true;
  // Timeout / Socks5 early eof / incomplete — CoreError types from Reacher.
  if (reasons.some((r) => r.startsWith("smtp_"))) return true;
  // Bare unknown with no SMTP detail (still worth a retry).
  return result.status === "unknown";
}

function retryDelayMs(attempt: number, result: ReacherResult): number {
  const proxyFlake = result.reason
    .split(",")
    .some((r) => /socks|timeout|unreachable|request_failed/i.test(r));
  const base = proxyFlake ? RETRY_DELAY_MS * 2 : RETRY_DELAY_MS;
  return base * attempt;
}

/**
 * Single attempt against self-hosted Reacher (/v1/check_email).
 */
async function verifyEmailOnce(
  email: string,
  secretOverride?: string
): Promise<ReacherResult> {
  try {
    const secret = secretOrUndefined(secretOverride);
    const client = reacherClient();

    const res = await client
      .post<ReacherCheckEmailOutput>(
        CHECK_PATH,
        {
          to_email: email,
          proxy: {
            host: PROXY_HOST,
            port: PROXY_PORT,
          },
        },
        { headers: authHeaders(secret) }
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "request_failed";
        console.error(`reacher check_email failed email=${email}`, message);
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

/**
 * POST check_email — retries transient unknown / smtp failures up to MAX_ATTEMPTS.
 * Pass `secretOverride` to override REACHER_SECRET for that call.
 */
export async function verifyEmail(
  email: string,
  secretOverride?: string
): Promise<ReacherResult> {
  let last = await verifyEmailOnce(email, secretOverride);

  for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt++) {
    if (!isRetryable(last)) return last;
    await sleep(retryDelayMs(attempt - 1, last));
    last = await verifyEmailOnce(email, secretOverride);
  }

  return last;
}

/**
 * Verifies many emails via concurrent check_email calls.
 * Prefer this over Reacher's /v1/bulk unless you also run RabbitMQ workers +
 * Postgres storage — bulk jobs need that queue stack.
 */
export async function verifyEmailsBulk(
  emails: string[],
  secretOverride?: string
): Promise<ReacherResult[]> {
  const runId = Date.now();
  const results = await mapWithConcurrency(
    emails,
    VERIFY_CONCURRENCY,
    async (email, index) => {
      // Stagger starts so one SOCKS proxy is not hit with N simultaneous
      // Gmail SMTP handshakes (logs: Socks5 early eof under burst).
      if (index > 0 && index < VERIFY_CONCURRENCY) {
        await sleep(index * 200);
      }
      return verifyEmail(email, secretOverride);
    }
  );

  await debugDump(`reacher-verify-${runId}-summary`, {
    submitted: emails.length,
    concurrency: VERIFY_CONCURRENCY,
    maxAttempts: MAX_ATTEMPTS,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    path: CHECK_PATH,
    valid: results.filter((r) => r.status === "valid").length,
    invalid: results.filter((r) => r.status === "invalid").length,
    unknown: results.filter((r) => r.status === "unknown").length,
  });

  return results;
}
