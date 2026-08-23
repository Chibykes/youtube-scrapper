"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SESSION_USERNAMES_KEY = "ytscraper:pendingUsernames";

type CommentAuthor = {
  username: string;
  channelUrl: string | null;
  commentCount: number;
};

export default function CommentScraperPage() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authors, setAuthors] = useState<CommentAuthor[]>([]);
  const [meta, setMeta] = useState<{
    threadsFetched: number;
    commentsDisabled: boolean;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!videoUrl.trim()) return;

    setLoading(true);
    setError("");
    setAuthors([]);
    setMeta(null);

    try {
      const res = await fetch("/api/scrape/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setAuthors(data.authors);
        setMeta({
          threadsFetched: data.threadsFetched,
          commentsDisabled: data.commentsDisabled,
        });
      }
    } catch {
      setError("Failed to reach the server");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    const rows = [
      ["Username", "Channel URL", "Comment Count"],
      ...authors.map((a) => [a.username, a.channelUrl ?? "", String(a.commentCount)]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "commenter-usernames.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function sendToEmailValidator() {
    const usernames = authors.map((a) => a.username).join("\n");
    sessionStorage.setItem(SESSION_USERNAMES_KEY, usernames);
    router.push("/dashboard/email-validator");
  }

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        ← Back to dashboard
      </Link>

      <h1 className="font-display text-3xl text-foreground">
        Comment Username Scraper
      </h1>
      <p className="mt-1 text-muted">
        Paste a YouTube video link to collect the usernames of everyone who
        commented. No API key needed.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 border border-border bg-surface p-5"
      >
        <label htmlFor="videoUrl" className="mb-2 block text-sm text-muted">
          Video URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="videoUrl"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 border border-border bg-surface-2 px-4 py-3 font-mono text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || !videoUrl.trim()}
            className="bg-accent px-5 py-3 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Scraping..." : "Get commenters"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-4 border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {meta?.commentsDisabled && (
        <p className="mt-4 border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
          Comments are disabled on this video.
        </p>
      )}

      {authors.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-foreground">
              {authors.length} unique commenter{authors.length === 1 ? "" : "s"}{" "}
              <span className="text-muted">
                ({meta?.threadsFetched ?? 0} threads scanned)
              </span>
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={downloadCsv}
                className="border border-border px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-foreground"
              >
                Export CSV
              </button>
              <button
                onClick={sendToEmailValidator}
                className="bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Convert to emails
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {authors.map((a) => (
                  <tr key={a.username} className="bg-surface">
                    <td className="px-4 py-3">
                      {a.channelUrl ? (
                        <a
                          href={a.channelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:text-accent"
                        >
                          {a.username}
                        </a>
                      ) : (
                        <span className="text-foreground">{a.username}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{a.commentCount}</td>
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
