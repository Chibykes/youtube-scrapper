import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyTransaction } from "@/lib/paystack";
import { creditWallet } from "@/lib/wallet";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reference = request.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  try {
    const transaction = await verifyTransaction(reference);

    if (transaction.metadata?.userId !== userId) {
      return NextResponse.json({ error: "Reference mismatch" }, { status: 403 });
    }

    if (transaction.status !== "success") {
      return NextResponse.json({ status: transaction.status });
    }

    const yoseAmount = Number(transaction.metadata?.yoseAmount);
    const wallet = await creditWallet({
      userId,
      amount: Number.isFinite(yoseAmount) && yoseAmount > 0
        ? yoseAmount
        : transaction.amountKobo / 100,
      description: "Paystack deposit",
      reference: transaction.reference,
      metadata: { amountKobo: transaction.amountKobo, currency: transaction.currency },
    });

    return NextResponse.json({ status: "success", balance: wallet.balance });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
