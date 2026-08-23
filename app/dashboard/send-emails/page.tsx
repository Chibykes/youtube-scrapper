"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SendResult = {
  email: string;
  success: boolean;
  error?: string;
};

type SendResponse = {
  total: number;
  succeeded: number;
  failed: number;
  results: SendResult[];
};

const STORAGE_EMAIL_KEY = "ytscraper:senderEmail";
const STORAGE_PASSWORD_KEY = "ytscraper:senderPassword";
const SESSION_SEND_EMAILS_KEY = "ytscraper:emailsToSend";

// Must match MAX_RECIPIENTS in app/api/send/route.ts. Sending is split into
// chunks so each /api/send call finishes well inside the 300s Serverless
// Function cap (Vercel Hobby's limit), instead of one call trying to send
// the whole list and getting killed mid-batch.
const CHUNK_SIZE = 50;

export default function SendEmailsPage() {
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPassword, setSenderPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emails, setEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResponse | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  // localStorage/sessionStorage don't exist during SSR, so this can only run
  // after mount — reading them in a lazy initializer instead would make the
  // client's first render disagree with the server-rendered HTML and
  // trigger a hydration mismatch.
  useEffect(() => {
    const storedEmail = localStorage.getItem(STORAGE_EMAIL_KEY);
    const storedPassword = localStorage.getItem(STORAGE_PASSWORD_KEY);
    const pendingRecipients = sessionStorage.getItem(SESSION_SEND_EMAILS_KEY);
    if (pendingRecipients) sessionStorage.removeItem(SESSION_SEND_EMAILS_KEY);

    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from browser storage on mount, not derivable from props/state */
    if (storedEmail) setSenderEmail(storedEmail);
    if (storedPassword) setSenderPassword(storedPassword);
    if (pendingRecipients) setEmails(pendingRecipients);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_EMAIL_KEY, senderEmail);
  }, [senderEmail]);

  useEffect(() => {
    localStorage.setItem(STORAGE_PASSWORD_KEY, senderPassword);
  }, [senderPassword]);

  const recipientCount = useMemo(() => {
    return Array.from(
      new Set(
        emails
          .split(/[\n,;]+/)
          .map((e) => e.trim())
          .filter(Boolean)
      )
    ).length;
  }, [emails]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const recipients = Array.from(
      new Set(
        emails
          .split(/[\n,;]+/)
          .map((r) => r.trim())
          .filter(Boolean)
      )
    );
    if (recipients.length === 0) return;

    const chunks: string[][] = [];
    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      chunks.push(recipients.slice(i, i + CHUNK_SIZE));
    }

    setSending(true);
    setBatchProgress({ done: 0, total: recipients.length });

    const aggregated: SendResult[] = [];
    try {
      for (const chunk of chunks) {
        const res = await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emails: chunk.join("\n"),
            subject,
            message,
            senderEmail,
            senderPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to send emails");
          break;
        }

        aggregated.push(...(data as SendResponse).results);
        setBatchProgress({ done: aggregated.length, total: recipients.length });
        setResult({
          total: aggregated.length,
          succeeded: aggregated.filter((r) => r.success).length,
          failed: aggregated.filter((r) => !r.success).length,
          results: aggregated,
        });
      }
    } catch {
      setError("Something went wrong partway through sending. Recipients not yet sent to were skipped.");
    } finally {
      setSending(false);
      setBatchProgress(null);
    }
  }

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        ← Back to dashboard
      </Link>

      <h1 className="font-display text-3xl text-foreground">Send Emails</h1>
      <p className="mt-1 text-muted">
        Send a broadcast over Gmail SMTP to a list of recipients — usually the
        validated emails from the Email Validator tool.
      </p>

      <form
        onSubmit={handleSend}
        className="mt-6 divide-y divide-border border border-border bg-surface"
      >
        <div className="space-y-4 p-5">
          <h2 className="text-sm font-medium text-foreground">Sender</h2>

          <div className="space-y-2 border border-amber-400/30 bg-amber-400/[0.06] p-3.5">
            <p className="text-xs leading-relaxed text-amber-300">
              <strong className="font-medium">This isn&apos;t your regular Gmail password.</strong>{" "}
              Google requires a 16-character <strong className="font-medium">App Password</strong>{" "}
              for apps like this one. Here&apos;s how to get one:
            </p>
            <ol className="list-inside list-decimal space-y-1 text-xs leading-relaxed text-amber-300/90">
              <li>
                Turn on 2-Step Verification (required first):{" "}
                <a
                  href="https://myaccount.google.com/signinoptions/two-step-verification"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-200"
                >
                  myaccount.google.com/signinoptions/two-step-verification
                </a>
              </li>
              <li>
                Generate an App Password for &quot;Mail&quot;:{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-200"
                >
                  myaccount.google.com/apppasswords
                </a>
              </li>
              <li>Paste the 16-character code below (spaces are fine).</li>
            </ol>
          </div>

          <div className="space-y-2">
            <label htmlFor="senderEmail" className="text-sm font-medium text-foreground">
              Your Gmail address
            </label>
            <input
              id="senderEmail"
              type="email"
              required
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="you@gmail.com"
              autoComplete="username"
              className="w-full border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="senderPassword" className="text-sm font-medium text-foreground">
              Gmail App Password
            </label>
            <div className="relative">
              <input
                id="senderPassword"
                type={showPassword ? "text" : "password"}
                required
                value={senderPassword}
                onChange={(e) => setSenderPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                autoComplete="current-password"
                className="w-full border border-border bg-surface-2 px-3 py-2.5 pr-16 font-mono text-sm text-foreground outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-muted hover:text-foreground"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-muted">
              Stored only in your browser&apos;s local storage, never on our servers.
            </p>
          </div>
        </div>

        <div className="space-y-2 p-5">
          <div className="flex items-center justify-between">
            <label htmlFor="emails" className="text-sm font-medium text-foreground">
              Recipients
            </label>
            <span className="text-xs tabular-nums text-muted">
              {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
            </span>
          </div>
          <textarea
            id="emails"
            required
            rows={6}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder={"jane@example.com\njohn@example.com"}
            className="w-full resize-y border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-accent"
          />
          <p className="text-xs text-muted">
            One per line, or comma-separated. Sent in batches of {CHUNK_SIZE} to
            stay within hosting limits — results update live as each batch
            finishes.
          </p>
        </div>

        <div className="space-y-2 p-5">
          <label htmlFor="subject" className="text-sm font-medium text-foreground">
            Subject
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="(optional)"
            className="w-full border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-2 p-5">
          <label htmlFor="message" className="text-sm font-medium text-foreground">
            Message
          </label>
          <textarea
            id="message"
            required
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message..."
            className="w-full resize-y border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-3 p-5">
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={sending || recipientCount === 0 || !message.trim()}
            className="w-full bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending
              ? `Sending... ${batchProgress?.done ?? 0}/${batchProgress?.total ?? recipientCount}`
              : `Send to ${recipientCount || 0} recipient${recipientCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-8 border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-medium text-foreground">
              {result.failed === 0
                ? `All ${result.succeeded} email${result.succeeded === 1 ? "" : "s"} sent successfully`
                : `${result.succeeded} sent, ${result.failed} failed`}
            </h2>
            <span
              className={`border px-2 py-0.5 text-xs ${
                result.failed === 0
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-amber-400/30 bg-amber-400/10 text-amber-400"
              }`}
            >
              {result.total} total
            </span>
          </div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {result.results.map((r) => (
              <li
                key={r.email}
                className="flex items-start justify-between gap-4 px-5 py-2.5 text-sm"
              >
                <span className="break-all font-mono text-[13px] text-foreground/90">
                  {r.email}
                </span>
                {r.success ? (
                  <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-success">
                    <span className="h-1.5 w-1.5 bg-success" />
                    Sent
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1.5 text-right text-danger">
                    <span className="h-1.5 w-1.5 shrink-0 bg-danger" />
                    Failed{r.error ? `: ${r.error}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
