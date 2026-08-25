import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyEmail } from "@/network/listClean";
import {
  getBalance,
  debitWallet,
  InsufficientBalanceError,
} from "@/lib/wallet";
import { TOOL_COSTS, CURRENCY } from "@/lib/pricing";

export const maxDuration = 30;

// Single-email counterpart to /api/scrape/validate-emails — used by the
// per-row "re-validate" action so revalidating one email doesn't round-trip
// through the batch/poll/backfill machinery meant for large lists.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const apiKey =
    typeof body?.apiKey === "string" && body.apiKey.trim()
      ? body.apiKey.trim()
      : undefined;

  if (!username || !email) {
    return NextResponse.json(
      { error: "Provide a username/email pair" },
      { status: 400 }
    );
  }

  const cost = TOOL_COSTS.emailValidator ?? 0;

  if (cost > 0) {
    const balance = await getBalance(userId);
    if (balance < cost) {
      return NextResponse.json(
        {
          error: `This will cost ${cost} ${CURRENCY} but your balance is ${balance} ${CURRENCY}. Add funds and try again.`,
          code: "insufficient_balance",
          required: cost,
          balance,
        },
        { status: 402 }
      );
    }
  }

  let result: { username: string; email: string; status: string; reason?: string };
  try {
    const validation = await verifyEmail(email, apiKey);
    result = {
      username,
      email,
      status: validation.status,
      reason: validation.reason,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let balance: number | null = null;
  if (cost > 0) {
    try {
      const wallet = await debitWallet({
        userId,
        amount: cost,
        description: `Validated 1 email with listclean`,
        metadata: { tool: "emailValidator", count: 1 },
      });
      balance = wallet.balance;
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          {
            error: "Balance ran out. This email was still validated.",
            code: "insufficient_balance",
            result,
          },
          { status: 402 }
        );
      }
      throw err;
    }
  }

  return NextResponse.json({ result, balance });
}
