import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { usernamesToEmailCandidates } from "@/lib/emailGuess";
import { validateEmail } from "@/lib/mailsSo";
import { mapWithConcurrency } from "@/lib/youtube";
import { getBalance, debitWallet, InsufficientBalanceError } from "@/lib/wallet";
import { TOOL_COSTS, CURRENCY } from "@/lib/pricing";

export const maxDuration = 60;

const MAX_USERNAMES = 500;

type ConvertedEmail = {
  username: string;
  email: string;
  status: "valid" | "invalid" | "unknown";
  reason?: string;
};

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const usernames: unknown = body?.usernames;
  const apiKey = typeof body?.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : undefined;

  if (!Array.isArray(usernames) || usernames.length === 0) {
    return NextResponse.json(
      { error: "Provide a non-empty list of usernames" },
      { status: 400 }
    );
  }

  const cleaned = usernames
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .slice(0, MAX_USERNAMES);

  if (cleaned.length === 0) {
    return NextResponse.json(
      { error: "Provide a non-empty list of usernames" },
      { status: 400 }
    );
  }

  const candidates = usernamesToEmailCandidates(cleaned);

  if (candidates.length === 0) {
    return NextResponse.json({ results: [] satisfies ConvertedEmail[] });
  }

  const costPerValidation = TOOL_COSTS.emailValidator ?? 0;
  const estimatedCost = costPerValidation * candidates.length;

  if (estimatedCost > 0) {
    const balance = await getBalance(userId);
    if (balance < estimatedCost) {
      return NextResponse.json(
        {
          error: `This will cost ${estimatedCost} ${CURRENCY} but your balance is ${balance} ${CURRENCY}. Add funds and try again.`,
          code: "insufficient_balance",
          required: estimatedCost,
          balance,
        },
        { status: 402 }
      );
    }
  }

  let results: ConvertedEmail[];
  try {
    results = await mapWithConcurrency(candidates, 5, async (candidate) => {
      const validation = await validateEmail(candidate.email, apiKey);
      return {
        username: candidate.username,
        email: candidate.email,
        status: validation.status,
        reason: validation.reason,
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let balance: number | null = null;
  if (costPerValidation > 0 && results.length > 0) {
    try {
      const wallet = await debitWallet({
        userId,
        amount: costPerValidation * results.length,
        description: `Validated ${results.length} email${results.length === 1 ? "" : "s"} with mails.so`,
        metadata: { tool: "emailValidator", count: results.length },
      });
      balance = wallet.balance;
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          { error: "Balance ran out mid-run. Results below were still validated.", code: "insufficient_balance", results },
          { status: 402 }
        );
      }
      throw err;
    }
  }

  return NextResponse.json({ results, balance });
}
