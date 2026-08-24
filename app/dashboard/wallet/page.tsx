import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getBalance, listTransactions } from "@/lib/wallet";
import { CURRENCY, getYoseToNgnRate } from "@/lib/pricing";
import DepositForm from "@/components/DepositForm";

export default async function WalletPage() {
  const { userId } = await auth();
  const [balance, transactions] = await Promise.all([
    getBalance(userId!),
    listTransactions(userId!),
  ]);
  const rate = getYoseToNgnRate();

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        ← Back to dashboard
      </Link>

      <h1 className="font-display text-3xl text-foreground">Wallet</h1>
      <p className="mt-1 text-muted">
        Your {CURRENCY} balance pays for tool runs across the platform.
      </p>

      <div className="mt-6 border border-border bg-surface p-6">
        <p className="text-xs uppercase tracking-wider text-muted">Balance</p>
        <p className="font-display mt-2 text-4xl text-foreground">
          {balance.toFixed(2)} <span className="text-2xl text-muted">{CURRENCY}</span>
        </p>
        <p className="mt-2 text-xs text-muted">
          Rate: ₦{rate} = 1 {CURRENCY} — placeholder, subject to change.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-medium text-foreground">Add funds</h2>
          <DepositForm ngnRate={rate} />
        </div>

        <div>
          <h2 className="mb-3 font-medium text-foreground">Recent activity</h2>
          {transactions.length === 0 ? (
            <p className="border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
              No transactions yet.
            </p>
          ) : (
            <div className="border border-border bg-surface">
              <ul className="max-h-96 divide-y divide-border overflow-y-auto">
                {transactions.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="text-foreground">{t.description}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {new Date(t.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={
                        t.type === "deposit"
                          ? "shrink-0 text-success"
                          : "shrink-0 text-muted"
                      }
                    >
                      {t.type === "deposit" ? "+" : "−"}
                      {t.amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
