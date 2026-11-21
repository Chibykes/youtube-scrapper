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

// Self-hosted Reacher has no batch endpoint without RabbitMQ workers, so bulk
// verification fans out to concurrent POST /v1/check_email calls. Keep this
// low — Reacher's default throttle is ~60/min and SMTP reputation burns fast.
const VERIFY_CONCURRENCY = 5;
// SMTP + proxy handshake can take tens of seconds per address.
const REQUEST_TIMEOUT_MS = 90_000;

function baseUrl(): string {
  const url = process.env.REACHER_URL?.replace(/\/$/, "");
  if (!url) throw new Error("REACHER_URL is not set");
  return url;
}

function secretOrUndefined(override?: string): string | undefined {
  const secret = override?.trim() || process.env.REACHER_SECRET?.trim();
  return secret || undefined;
}

function reacherClient() {
  return createHttpClient({
    baseURL: baseUrl(),
    timeout: REQUEST_TIMEOUT_MS,
    headers: { "Content-Type": "application/json" },
  });
}

function authHeaders(secret?: string): Record<string, string> {
  // Self-hosted auth uses x-reacher-secret (RCH__HEADER_SECRET), not Bearer.
  if (!secret) return {};
  return { "x-reacher-secret": secret };
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
 * POST /v1/check_email — single-address verification against self-hosted
 * Reacher. Queued server-side under throttle; HTTP call still waits for the
 * verdict. Pass `secretOverride` to override REACHER_SECRET for that call.
 */
export async function verifyEmail(
  email: string,
  secretOverride?: string
): Promise<ReacherResult> {
  const secret = secretOrUndefined(secretOverride);
  const client = reacherClient();

  const res = await client
    .post<ReacherCheckEmailOutput>(
      "/v1/check_email",
      { to_email: email },
      { headers: authHeaders(secret) }
    )
    .catch(() => null);

  if (!res || res.status >= 400) {
    return toResult(undefined, email, res ? `http_${res.status}` : "request_failed");
  }

  return toResult(res.data, email);
}

/**
 * Verifies many emails via concurrent POST /v1/check_email calls.
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
    (email) => verifyEmail(email, secretOverride)
  );

  await debugDump(`reacher-verify-${runId}-summary`, {
    submitted: emails.length,
    concurrency: VERIFY_CONCURRENCY,
    valid: results.filter((r) => r.status === "valid").length,
    invalid: results.filter((r) => r.status === "invalid").length,
    unknown: results.filter((r) => r.status === "unknown").length,
  });

  return results;
}
