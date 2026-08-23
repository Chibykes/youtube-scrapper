export type EmailValidationStatus = "valid" | "invalid" | "unknown";

export type EmailValidationResult = {
  email: string;
  status: EmailValidationStatus;
  result?: string;
  reason?: string;
};

function getApiKey(override: string | undefined): string {
  const key = override || process.env.MAILSO_API_KEY;
  if (!key) throw new Error("No mails.so API key provided");
  return key;
}

// mails.so's /v1/validate returns a `result` field such as "deliverable",
// "undeliverable", "risky", or "unknown". We fold "risky" into "unknown"
// rather than treating it as valid, since we can't confirm it sends.
function toStatus(result: string | undefined): EmailValidationStatus {
  if (!result) return "unknown";
  const normalized = result.toLowerCase();
  if (normalized === "deliverable" || normalized === "valid") return "valid";
  if (normalized === "undeliverable" || normalized === "invalid") return "invalid";
  return "unknown";
}

export async function validateEmail(
  email: string,
  apiKeyOverride?: string
): Promise<EmailValidationResult> {
  const apiKey = getApiKey(apiKeyOverride);
  const url = new URL("https://api.mails.so/v1/validate");
  url.searchParams.set("email", email);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-mails-api-key": apiKey },
      cache: "no-store",
    });
  } catch (err) {
    return {
      email,
      status: "unknown",
      reason: err instanceof Error ? err.message : "Request failed",
    };
  }

  if (!res.ok) {
    return { email, status: "unknown", reason: `HTTP ${res.status}` };
  }

  const body = await res.json().catch(() => null);
  const data = body?.data ?? body ?? {};
  const result: string | undefined = data.result;
  const reason: string | undefined = data.reason;

  return { email, status: toStatus(result), result, reason };
}
