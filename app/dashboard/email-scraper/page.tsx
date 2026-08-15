"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type ChannelResult = {
  input: string;
  channelTitle: string | null;
  aboutUrl: string | null;
  emails: string[];
  status: "ok" | "no-email" | "error";
  error?: string;
};

export default function EmailScraperPage() {
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ChannelResult[]>([]);

  const channelCount = useMemo(
    () => raw.split("\n").map((l) => l.trim()).filter(Boolean).length,
    [raw]
  );

  const foundCount = results.filter((r) => r.emails.length > 0).length;

  async function handleSubmit() {
    const channels = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (channels.length === 0) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch("/api/scrape/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setResults(data.results);
      }
    } catch {
      setError("Failed to reach the server");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    const rows = [
      ["Input", "Channel", "Emails", "About URL", "Status"],
      ...results.map((r) => [
        r.input,
        r.channelTitle ?? "",
        r.emails.join("; "),
        r.aboutUrl ?? "",
        r.status,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "channel-emails.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        ← Back to dashboard
      </Link>

      <h1 className="text-2xl font-semibold text-foreground">
        Channel Email Scraper
      </h1>
      <p className="mt-1 text-muted">
        Paste one channel per line — handles (@name), full URLs, or channel
        IDs all work. We scan each channel&apos;s About page for visible email
        addresses.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          placeholder={"@mkbhd\nhttps://www.youtube.com/@veritasium\nUCX6OQ3DkcsbYNE6H8uQQuVA"}
          className="w-full resize-y rounded-lg border border-border bg-surface-2 p-4 font-mono text-sm text-foreground outline-none focus:border-accent"
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted">
            {channelCount} channel{channelCount === 1 ? "" : "s"}
          </span>
          <button
            onClick={handleSubmit}
            disabled={loading || channelCount === 0}
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Scraping..." : "Scrape emails"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-foreground">
              Results — {foundCount} of {results.length} found an email
            </h2>
            <button
              onClick={downloadCsv}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-foreground"
            >
              Export CSV
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Emails</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((r, i) => (
                  <tr key={i} className="bg-surface">
                    <td className="px-4 py-3">
                      <div className="text-foreground">
                        {r.channelTitle ?? r.input}
                      </div>
                      {r.aboutUrl && (
                        <a
                          href={r.aboutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted hover:text-accent"
                        >
                          {r.aboutUrl}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.emails.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {r.emails.map((email) => (
                            <span key={email} className="font-mono text-foreground">
                              {email}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">
                          {r.error ?? "No email found"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ChannelResult["status"] }) {
  const styles = {
    ok: "bg-success/10 text-success",
    "no-email": "bg-surface-2 text-muted",
    error: "bg-danger/10 text-danger",
  } as const;
  const labels = {
    ok: "Found",
    "no-email": "No email",
    error: "Error",
  } as const;

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
