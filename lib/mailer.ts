import nodemailer from "nodemailer";
import PQueue from "p-queue";

export type SendResult = {
  email: string;
  success: boolean;
  error?: string;
};

// Sequential queue with a small delay between sends to stay well under
// Gmail's rate limits (~500 msgs/day, bursts throttled).
const queue = new PQueue({ concurrency: 1, interval: 1000, intervalCap: 1 });

export async function createGmailTransporter(senderEmail: string, senderPassword: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: senderPassword },
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
    queue.add(async (): Promise<SendResult> => {
      try {
        await transporter.sendMail({
          from: senderEmail,
          to: email,
          subject,
          text: message,
        });
        return { email, success: true };
      } catch (err) {
        return {
          email,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    })
  );

  const results = await Promise.all(jobs);
  return results as SendResult[];
}
