"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ConvertedEmail = {
  username: string;
  email: string;
  status: "valid" | "invalid" | "unknown";
  reason?: string;
};

const SESSION_USERNAMES_KEY = "ytscraper:pendingUsernames";
const SESSION_SEND_EMAILS_KEY = "ytscraper:emailsToSend";
const STORAGE_MAILSO_KEY_KEY = "ytscraper:mailsoApiKey";

export default function EmailValidatorPage() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ConvertedEmail[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // localStorage/sessionStorage don't exist during SSR, so this can only run
  // after mount — reading them in the initializer instead would make the
  // client's first render disagree with the server-rendered HTML and
  // trigger a hydration mismatch.
  useEffect(() => {
    const pending = sessionStorage.getItem(SESSION_USERNAMES_KEY);
    const storedApiKey = localStorage.getItem(STORAGE_MAILSO_KEY_KEY);
    if (pending) sessionStorage.removeItem(SESSION_USERNAMES_KEY);

    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from browser storage on mount, not derivable from props/state */
    if (pending) setRaw(pending);
    if (storedApiKey) setApiKey(storedApiKey);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const usernameCount = useMemo(
    () => raw.split("\n").map((l) => l.trim()).filter(Boolean).length,
    [raw]
  );

  const validCount = results.filter((r) => r.status === "valid").length;

  async function handleSubmit() {
    const usernames = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (usernames.length === 0) return;

    const trimmedApiKey = apiKey.trim();
    localStorage.setItem(STORAGE_MAILSO_KEY_KEY, trimmedApiKey);

    setLoading(true);
    setError("");
    setResults([]);
    setSelected(new Set());

    try {
      const res = await fetch("/api/scrape/convert-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames, apiKey: trimmedApiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        const converted: ConvertedEmail[] = data.results;
        setResults(converted);
        setSelected(new Set(converted.filter((r) => r.status === "valid").map((r) => r.email)));
      }
    } catch {
      setError("Failed to reach the server");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  }

  function downloadCsv() {
    const rows = [
      ["Username", "Email", "Status", "Reason"],
      ...results.map((r) => [r.username, r.email, r.status, r.reason ?? ""]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "validated-emails.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function sendSelected() {
    if (selected.size === 0) return;
    sessionStorage.setItem(SESSION_SEND_EMAILS_KEY, Array.from(selected).join("\n"));
    router.push("/dashboard/send-emails");
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
        Username → Email Validator
      </h1>
      <p className="mt-1 text-muted">
        Paste YouTube usernames (one per line). We&apos;ll guess a Gmail
        address for each — a leading @ is dropped, and hyphenated names are
        truncated at the hyphen — then validate every guess with mails.so
        before you send anything.
      </p>

      <div className="mt-6 border border-border bg-surface p-5">
        <label htmlFor="mailsoApiKey" className="mb-2 block text-sm text-muted">
          mails.so API key
        </label>
        <div className="relative">
          <input
            id="mailsoApiKey"
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Your mails.so API key"
            autoComplete="off"
            className="w-full border border-border bg-surface-2 px-4 py-2.5 pr-16 font-mono text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            {showApiKey ? "Hide" : "Show"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Stored only in your browser&apos;s local storage, never on our servers.
        </p>

        <label htmlFor="usernames" className="mb-2 mt-4 block text-sm text-muted">
          Usernames
        </label>
        <textarea
          id="usernames"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          placeholder={"mrbeast\ncool-guy99\n@johndoe123"}
          className="w-full resize-y border border-border bg-surface-2 p-4 font-mono text-sm text-foreground outline-none focus:border-accent"
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-muted">
            {usernameCount} username{usernameCount === 1 ? "" : "s"}
          </span>
          <button
            onClick={handleSubmit}
            disabled={loading || usernameCount === 0}
            className="bg-accent px-5 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Validating..." : "Convert & validate"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium text-foreground">
              {validCount} of {results.length} validated as deliverable
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={downloadCsv}
                className="border border-border px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-foreground"
              >
                Export CSV
              </button>
              <button
                onClick={sendSelected}
                disabled={selected.size === 0}
                className="bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send to {selected.size} selected
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Guessed email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((r) => (
                  <tr key={r.email} className="bg-surface">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.email)}
                        onChange={() => toggleSelected(r.email)}
                        className="h-4 w-4 accent-accent"
                      />
                    </td>
                    <td className="px-4 py-3 text-foreground">{r.username}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{r.email}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} reason={r.reason} />
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

function StatusBadge({
  status,
  reason,
}: {
  status: ConvertedEmail["status"];
  reason?: string;
}) {
  const styles = {
    valid: "border-success/30 bg-success/10 text-success",
    invalid: "border-danger/30 bg-danger/10 text-danger",
    unknown: "border-border bg-surface-2 text-muted",
  } as const;
  const labels = {
    valid: "Valid",
    invalid: "Invalid",
    unknown: "Unknown",
  } as const;

  return (
    <span
      title={reason}
      className={`border px-2 py-0.5 text-xs uppercase tracking-wider ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
