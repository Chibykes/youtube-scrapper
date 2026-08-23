"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type VerifyState = "checking" | "success" | "pending" | "error";

export default function WalletCallbackPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted">Loading...</div>}>
      <WalletCallbackContent />
    </Suspense>
  );
}

function WalletCallbackContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");
  const [state, setState] = useState<VerifyState>("checking");
  const [message, setMessage] = useState("");
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!reference) return;

    fetch(`/api/wallet/deposit/verify?reference=${encodeURIComponent(reference)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setState("error");
          setMessage(data.error ?? "Verification failed");
          return;
        }
        if (data.status === "success") {
          setState("success");
          setBalance(data.balance);
        } else {
          setState("pending");
          setMessage(`Payment status: ${data.status}`);
        }
      })
      .catch(() => {
        setState("error");
        setMessage("Could not reach the server to verify this payment.");
      });
  }, [reference]);

  return (
    <div className="mx-auto max-w-sm py-20 text-center">
      {!reference && (
        <>
          <h1 className="font-display text-2xl text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-danger">Missing transaction reference.</p>
        </>
      )}
      {reference && state === "checking" && (
        <p className="text-muted">Confirming your payment...</p>
      )}
      {state === "success" && (
        <>
          <h1 className="font-display text-2xl text-foreground">
            Deposit confirmed
          </h1>
          <p className="mt-2 text-muted">
            New balance: {balance?.toFixed(2)} YOSE
          </p>
        </>
      )}
      {state === "pending" && (
        <>
          <h1 className="font-display text-2xl text-foreground">
            Still processing
          </h1>
          <p className="mt-2 text-muted">{message}</p>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="font-display text-2xl text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-danger">{message}</p>
        </>
      )}

      <Link
        href="/dashboard/wallet"
        className="mt-6 inline-block border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-accent"
      >
        Back to wallet
      </Link>
    </div>
  );
}
