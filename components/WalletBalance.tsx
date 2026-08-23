"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function WalletBalance() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      fetch("/api/wallet")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data) setBalance(data.balance);
        })
        .catch(() => {});
    }
    refresh();
    window.addEventListener("wallet:updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("wallet:updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return (
    <Link
      href="/dashboard/wallet"
      className="flex items-center gap-2 border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent"
    >
      <span className="h-1.5 w-1.5 bg-accent" />
      {balance === null ? "—" : balance.toFixed(2)}
      <span className="text-muted">YOSE</span>
    </Link>
  );
}
