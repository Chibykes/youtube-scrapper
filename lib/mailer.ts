import nodemailer from "nodemailer";
import PQueue from "p-queue";

export type SendResult = {
  email: string;
  success: boolean;
  error?: string;
};

// One send per 2s (~30/min) with a persistent connection, well under Gmail's
// undocumented per-minute throttling — the real constraint is the daily
// quota (~500 msgs/day on a free account), which this can't work around.
const SEND_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 4;
const BACKOFF_BASE_MS = 2000;

const queue = new PQueue({ concurrency: 1, interval: SEND_INTERVAL_MS, intervalCap: 1 });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gmail's SMTP throttling surfaces as a 4xx response (e.g. "421 4.7.0 Try
// again later"), distinct from a permanent rejection like a bad recipient
// (5xx) or bad auth. Only back off and retry on the former.
function isRetryable(err: unknown): boolean {
  const code = (err as { responseCode?: number } | undefined)?.responseCode;
  return typeof code === "number" && code >= 400 && code < 500;
}

async function sendOne(
  transporter: nodemailer.Transporter,
  senderEmail: string,
  email: string,
  subject: string,
  message: string
): Promise<SendResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await transporter.sendMail({
        from: senderEmail,
        to: email,
        subject,
        text: message,
      });
      return { email, success: true };
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      if (isRetryable(err) && !isLastAttempt) {
        await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
        continue;
      }
      return {
        email,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
  // Unreachable — the loop always returns on its final iteration.
  throw new Error("sendOne: exhausted attempts without returning");
}

export async function createGmailTransporter(senderEmail: string, senderPassword: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: senderPassword },
    pool: true,
  });

  // Fail fast with one clear error instead of repeating the same
  // auth failure once per recipient.
  await transporter.verify();

  return transporter;
}

export async function sendBulkEmails(
  transporter: nodemailer.Transporter,
  senderEmail: string,
  recipients: string[],
  subject: string,
  message: string
): Promise<SendResult[]> {
  const jobs = recipients.map((email) =>
    queue.add(() => sendOne(transporter, senderEmail, email, subject, message))
  );

  const results = await Promise.all(jobs);
  return results as SendResult[];
}
