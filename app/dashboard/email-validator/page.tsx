"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { validateEmails } from "@/network/internal";
import { usernamesToEmailCandidates } from "@/lib/emailGuess";
import { CURRENCY, TOOL_COSTS } from "@/lib/pricing";

type ValidationStatus = "pending" | "valid" | "invalid" | "unknown";

type Validation = {
  status: Exclude<ValidationStatus, "pending">;
  reason?: string;
};

const SESSION_USERNAMES_KEY = "ytscraper:pendingUsernames";
const SESSION_SEND_EMAILS_KEY = "ytscraper:emailsToSend";
const STORAGE_LISTCLEAN_KEY_KEY = "ytscraper:listcleanApiKey";
const COST_PER_VALIDATION = TOOL_COSTS.emailValidator ?? 0;

export default function EmailValidatorPage() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validations, setValidations] = useState<Map<string, Validation>>(
    new Map()
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // localStorage/sessionStorage don't exist during SSR, so this can only run
  // after mount — reading them in the initializer instead would make the
  // client's first render disagree with the server-rendered HTML and
  // trigger a hydration mismatch.
  useEffect(() => {
    const pending = sessionStorage.getItem(SESSION_USERNAMES_KEY);
    const storedApiKey = localStorage.getItem(STORAGE_LISTCLEAN_KEY_KEY);
    if (pending) sessionStorage.removeItem(SESSION_USERNAMES_KEY);

    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from browser storage on mount, not derivable from props/state */
    if (pending) setRaw(pending);
    if (storedApiKey) setApiKey(storedApiKey);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Guessing the Gmail address from a username is pure client-side string
  // manipulation (see lib/emailGuess.ts) — no need to round-trip to the
  // server just to show the list. Only validating against listclean costs
  // money and needs a server.
  const candidates = useMemo(() => {
    const usernames = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return usernamesToEmailCandidates(usernames).sort((a, b) =>
      a.email.localeCompare(b.email, undefined, { numeric: true })
    );
  }, [raw]);

  const rows = useMemo(
    () =>
      candidates.map((c) => {
        const v = validations.get(c.email);
        return {
          username: c.username,
          email: c.email,
          status: (v?.status ?? "pending") as ValidationStatus,
          reason: v?.reason,
        };
      }),
    [candidates, validations]
  );

  const validCount = rows.filter((r) => r.status === "valid").length;
  const validatedCount = rows.filter((r) => r.status !== "pending").length;
  const estimatedCost = candidates.length * COST_PER_VALIDATION;

  async function handleValidate() {
    if (candidates.length === 0) return;

    const trimmedApiKey = apiKey.trim();
    localStorage.setItem(STORAGE_LISTCLEAN_KEY_KEY, trimmedApiKey);

    setLoading(true);
    setError("");

    try {
      const res = await validateEmails({ candidates, apiKey: trimmedApiKey });
      const data = res.data;

      type ResultRow = {
        email: string;
        status: Validation["status"];
        reason?: string;
      };
      const applyResults = (results: ResultRow[]) => {
        setValidations((prev) => {
          const next = new Map(prev);
          for (const r of results) {
            next.set(r.email, { status: r.status, reason: r.reason });
          }
          return next;
        });
        setSelected(
          new Set(
            results.filter((r) => r.status === "valid").map((r) => r.email)
          )
        );
      };

      if (res.status >= 400) {
        setError(data.error ?? "Something went wrong");
        if (Array.isArray(data.results)) applyResults(data.results);
      } else {
        applyResults(data.results);
        if (typeof data.balance === "number") {
          window.dispatchEvent(new Event("wallet:updated"));
        }
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
    const csvRows = [
      ["Username", "Email", "Status", "Reason"],
      ...rows.map((r) => [r.username, r.email, r.status, r.reason ?? ""]),
    ];
    const csv = csvRows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      )
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
    sessionStorage.setItem(
      SESSION_SEND_EMAILS_KEY,
      Array.from(selected).join("\n")
    );
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
        Paste YouTube usernames (one per line) — a leading @ is dropped, and
        hyphenated names are truncated at the hyphen. The guessed Gmail
        addresses show up instantly below; validating them against listclean is
        what costs {CURRENCY} and needs a click.
      </p>

      <div className="mt-6 border border-border bg-surface p-5">
        <label
          htmlFor="listcleanApiKey"
          className="mb-2 block text-sm text-muted"
        >
          listclean API key
        </label>
        <div className="relative">
          <input
            id="listcleanApiKey"
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Your listclean API key"
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
          Stored only in your browser&apos;s local storage, never on our
          servers.
        </p>

        <label
          htmlFor="usernames"
          className="mb-2 mt-4 block text-sm text-muted"
        >
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
            {candidates.length} email{candidates.length === 1 ? "" : "s"}{" "}
            guessed
            {COST_PER_VALIDATION > 0 && candidates.length > 0 && (
              <>
                {" "}
                — validating costs {estimatedCost} {CURRENCY}
              </>
            )}
          </span>
          <button
            onClick={handleValidate}
            disabled={loading || candidates.length === 0}
            className="bg-accent px-5 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Validating..."
              : validatedCount > 0
              ? "Re-validate"
              : "Validate with listclean"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}{" "}
          {error.toLowerCase().includes("balance") && (
            <Link
              href="/dashboard/wallet"
              className="underline hover:text-danger/80"
            >
              Add funds
            </Link>
          )}
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium text-foreground">
              {validatedCount > 0
                ? `${validCount} of ${rows.length} validated as deliverable`
                : `${rows.length} guessed, not yet validated`}
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
                {rows.map((r) => (
                  <tr key={r.email} className="bg-surface">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.email)}
                        onChange={() => toggleSelected(r.email)}
                        disabled={r.status !== "valid"}
                        className="h-4 w-4 accent-accent disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-3 text-foreground">{r.username}</td>
                    <td className="px-4 py-3 font-mono text-foreground">
                      {r.email}
                    </td>
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
  status: ValidationStatus;
  reason?: string;
}) {
  const styles = {
    pending: "border-border bg-surface-2 text-muted",
    valid: "border-success/30 bg-success/10 text-success",
    invalid: "border-danger/30 bg-danger/10 text-danger",
    unknown: "border-border bg-surface-2 text-muted",
  } as const;
  const labels = {
    pending: "Pending",
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
