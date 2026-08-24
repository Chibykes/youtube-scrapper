export type EmailValidationStatus = "valid" | "invalid" | "unknown";

export type EmailValidationResult = {
  email: string;
  status: EmailValidationStatus;
  result?: string;
  reason?: string;
  score?: number;
};

// Minimum mails.so validation score (0-100) at which we'll treat an
// otherwise-inconclusive result ("risky", "unknown", or a genuine timeout
// on their end that still came back with a score) as deliverable.
const SCORE_VALID_THRESHOLD = 50;

function getApiKey(override: string | undefined): string {
  const key = override || process.env.MAILSO_API_KEY;
  if (!key) throw new Error("No mails.so API key provided");
  return key;
}

// mails.so's /v1/validate and /v1/batch return a `result` field such as
// "deliverable", "undeliverable", "risky", or "unknown", plus a 0-100
// `score`. "deliverable"/"undeliverable" are unambiguous. Everything else
// (including their own "risky" bucket, or a per-email timeout that still
// came back with a score) falls back to the score: above the threshold we
// call it valid, otherwise it stays unknown.
function toStatus(result: string | undefined, score: number | undefined): EmailValidationStatus {
  const normalized = result?.toLowerCase();
  if (normalized === "deliverable" || normalized === "valid") return "valid";
  if (normalized === "undeliverable" || normalized === "invalid") return "invalid";
  if (typeof score === "number" && score >= SCORE_VALID_THRESHOLD) return "valid";
  return "unknown";
}

// Builds the { status, reason } pair for one mails.so result, noting in the
// reason when a "risky"/"unknown" result was upgraded to valid on score
// alone — so it's obvious in the UI why an email marked "valid" wasn't a
// clean "deliverable" from mails.so.
function describeResult(
  result: string | undefined,
  score: number | undefined,
  reason: string | undefined
): { status: EmailValidationStatus; reason: string | undefined } {
  const status = toStatus(result, score);
  const scoredOverride = status === "valid" && result?.toLowerCase() !== "deliverable";
  return {
    status,
    reason: scoredOverride ? `score ${score} (${reason ?? result ?? "unknown"})` : reason,
  };
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
  const rawReason: string | undefined = data.reason;
  const score: number | undefined = typeof data.score === "number" ? data.score : undefined;
  const { status, reason } = describeResult(result, score, rawReason);

  return { email, status, result, reason, score };
}

type BatchJob = {
  id: string;
  size: number;
  finished_at: string | null;
};

type BatchEmailResult = {
  email: string;
  result?: string;
  reason?: string;
  score?: number;
};

type BatchJobResult = BatchJob & {
  emails: BatchEmailResult[];
};

async function submitBatch(emails: string[], apiKey: string): Promise<BatchJob> {
  const res = await fetch("https://api.mails.so/v1/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mails-api-key": apiKey,
    },
    body: JSON.stringify({ emails }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `mails.so batch submit failed (HTTP ${res.status})`);
  }

  return res.json();
}

async function getBatch(id: string, apiKey: string): Promise<BatchJobResult> {
  const res = await fetch(`https://api.mails.so/v1/batch/${id}`, {
    headers: { "x-mails-api-key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `mails.so batch fetch failed (HTTP ${res.status})`);
  }

  return res.json();
}

// Dev-only: writes a finished batch response to disk so we have a real
// sample of mails.so's bulk API shape for documentation/reference. Never
// runs in production — Vercel's filesystem is read-only there anyway.
async function logBatchSample(job: BatchJobResult) {
  if (process.env.NODE_ENV === "production") return;
  try {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "docs");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${job.id}-mailsso-batch-sample.json`),
      JSON.stringify(job, null, 2)
    );
  } catch {
    // best-effort — logging a sample should never break validation
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polls a single batch job until mails.so marks it finished, or until
// `deadline` (a Date.now() timestamp) passes — whichever comes first.
async function pollBatch(
  id: string,
  apiKey: string,
  deadline: number,
  pollIntervalMs: number
): Promise<BatchJobResult | null> {
  while (Date.now() < deadline) {
    const job = await getBatch(id, apiKey);
    if (job.finished_at) {
      await logBatchSample(job);
      return job;
    }
    await sleep(pollIntervalMs);
  }
  return null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Validates a list of emails using mails.so's bulk batch API instead of one
 * request per email. Large lists are split into chunks (mails.so doesn't
 * document a max batch size, so we cap it ourselves), each chunk is
 * submitted as its own batch job, and jobs are polled concurrently.
 *
 * Emails still pending when `maxWaitMs` elapses come back as "unknown" with
 * a timeout reason, so the caller always gets a result per email.
 */
export async function validateEmailsBulk(
  emails: string[],
  apiKeyOverride: string | undefined,
  options: { chunkSize?: number; pollIntervalMs?: number; maxWaitMs?: number } = {}
): Promise<EmailValidationResult[]> {
  const apiKey = getApiKey(apiKeyOverride);
  const chunkSize = options.chunkSize ?? 200;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const maxWaitMs = options.maxWaitMs ?? 45_000;
  const deadline = Date.now() + maxWaitMs;

  const batches = chunk(emails, chunkSize);

  const jobs = await Promise.all(
    batches.map(async (batchEmails) => {
      try {
        const job = await submitBatch(batchEmails, apiKey);
        return { batchEmails, jobId: job.id as string | null };
      } catch {
        return { batchEmails, jobId: null };
      }
    })
  );

  const resultsByEmail = new Map<string, EmailValidationResult>();

  await Promise.all(
    jobs.map(async ({ batchEmails, jobId }) => {
      if (!jobId) {
        for (const email of batchEmails) {
          resultsByEmail.set(email, {
            email,
            status: "unknown",
            reason: "Failed to submit for validation",
          });
        }
        return;
      }

      let finished: BatchJobResult | null = null;
      try {
        finished = await pollBatch(jobId, apiKey, deadline, pollIntervalMs);
      } catch {
        finished = null;
      }

      if (!finished) {
        for (const email of batchEmails) {
          resultsByEmail.set(email, {
            email,
            status: "unknown",
            reason: "Validation timed out",
          });
        }
        return;
      }

      const byEmail = new Map(finished.emails.map((e) => [e.email, e]));
      for (const email of batchEmails) {
        const entry = byEmail.get(email);
        const { status, reason } = describeResult(entry?.result, entry?.score, entry?.reason);
        resultsByEmail.set(email, {
          email,
          status,
          result: entry?.result,
          reason,
          score: entry?.score,
        });
      }
    })
  );

  return emails.map(
    (email) =>
      resultsByEmail.get(email) ?? { email, status: "unknown", reason: "No result returned" }
  );
}
