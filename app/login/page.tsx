"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Incorrect PIN");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-6 w-6"
            >
              <path d="M21.582 7.186a2.512 2.512 0 0 0-1.768-1.782C18.254 5 12 5 12 5s-6.254 0-7.814.404a2.512 2.512 0 0 0-1.768 1.782C2 8.758 2 12 2 12s0 3.242.418 4.814a2.512 2.512 0 0 0 1.768 1.782C5.746 19 12 19 12 19s6.254 0 7.814-.404a2.512 2.512 0 0 0 1.768-1.782C22 15.242 22 12 22 12s0-3.242-.418-4.814ZM10 15.5v-7l6 3.5-6 3.5Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            YT Scraper
          </h1>
          <p className="mt-1 text-sm text-muted">Enter your PIN to continue</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-6 shadow-xl shadow-black/20"
        >
          <label htmlFor="pin" className="mb-2 block text-sm text-muted">
            PIN
          </label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="w-full rounded-lg border border-border bg-surface-2 px-4 py-3 text-center text-lg tracking-[0.5em] text-foreground outline-none focus:border-accent"
          />

          {error && (
            <p className="mt-3 text-center text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || pin.length === 0}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-3 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Checking..." : "Unlock"}
          </button>
        </form>
      </div>
    </main>
  );
}
