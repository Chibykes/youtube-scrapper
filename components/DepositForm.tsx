"use client";

import { useState } from "react";

export default function DepositForm({ ngnRate }: { ngnRate: number }) {
  const [amountNgn, setAmountNgn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const parsed = Number(amountNgn);
  const yoseAmount = Number.isFinite(parsed) && parsed > 0 ? parsed / ngnRate : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountNgn: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start deposit");
        setLoading(false);
        return;
      }
      window.location.href = data.authorizationUrl;
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-surface p-5">
      <label htmlFor="amountNgn" className="mb-2 block text-sm text-muted">
        Amount (NGN)
      </label>
      <input
        id="amountNgn"
        type="number"
        min={100}
        step={50}
        value={amountNgn}
        onChange={(e) => setAmountNgn(e.target.value)}
        placeholder="5000"
        className="w-full border border-border bg-surface-2 px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
      />
      <p className="mt-2 text-xs text-muted">
        {yoseAmount > 0
          ? `≈ ${yoseAmount.toFixed(2)} YOSE at the current rate`
          : `Minimum ₦100`}
      </p>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={loading || !(parsed >= 100)}
        className="mt-4 w-full bg-accent px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Redirecting to Paystack..." : "Deposit with Paystack"}
      </button>
    </form>
  );
}
