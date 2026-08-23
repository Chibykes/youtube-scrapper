import { NextRequest, NextResponse } from "next/server";
import { createGmailTransporter, sendBulkEmails } from "@/lib/mailer";

// Vercel's Hobby plan hard-caps Serverless Functions at 300s, so this route
// can't just send an arbitrarily large batch in one call. The client
// (app/dashboard/send-emails/page.tsx) splits recipients into chunks of
// MAX_RECIPIENTS and calls this route once per chunk, so each call only
// needs to fit its own chunk's send time (chunk size * ~2s/send, plus
// backoff headroom) inside the cap.
export const maxDuration = 300;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 50;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { emails, subject, message, senderEmail, senderPassword } = body as {
    emails?: string;
    subject?: string;
    message?: string;
    senderEmail?: string;
    senderPassword?: string;
  };

  if (typeof senderEmail !== "string" || !EMAIL_RE.test(senderEmail.trim())) {
    return NextResponse.json(
      { error: "A valid sender Gmail address is required" },
      { status: 400 }
    );
  }

  if (typeof senderPassword !== "string" || !senderPassword.trim()) {
    return NextResponse.json(
      { error: "Your Gmail app password is required" },
      { status: 400 }
    );
  }

  if (typeof emails !== "string" || typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { error: "emails and message are required" },
      { status: 400 }
    );
  }

  const recipients = Array.from(
    new Set(
      emails
        .split(/[\n,;]+/)
        .map((e) => e.trim())
        .filter(Boolean)
    )
  );

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients provided" }, { status: 400 });
  }

  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `Too many recipients (max ${MAX_RECIPIENTS})` },
      { status: 400 }
    );
  }

  const invalid = recipients.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Invalid email address(es): ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  const trimmedSender = senderEmail.trim();

  let transporter;
  try {
    transporter = await createGmailTransporter(trimmedSender, senderPassword.trim());
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not sign in to Gmail. Make sure you're using an App Password, not your regular Gmail password.",
      },
      { status: 401 }
    );
  }

  const results = await sendBulkEmails(
    transporter,
    trimmedSender,
    recipients,
    subject?.trim() || "(no subject)",
    message
  );

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);

  return NextResponse.json({
    total: results.length,
    succeeded,
    failed: failed.length,
    results,
  });
}
