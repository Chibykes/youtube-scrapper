import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyEmailsBulk } from "@/lib/listClean";
import { getBalance, debitWallet, InsufficientBalanceError } from "@/lib/wallet";
import { TOOL_COSTS, CURRENCY } from "@/lib/pricing";

export const maxDuration = 60;

const MAX_CANDIDATES = 500;

type Candidate = {
  username: string;
  email: string;
};

type ValidatedEmail = {
  username: string;
  email: string;
  status: "valid" | "invalid" | "unknown";
  reason?: string;
};

function parseCandidates(input: unknown): Candidate[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const item of input) {
    const username = typeof item?.username === "string" ? item.username.trim() : "";
    const email = typeof item?.email === "string" ? item.email.trim().toLowerCase() : "";
    if (!username || !email || seen.has(email)) continue;
    seen.add(email);
    candidates.push({ username, email });
  }

  return candidates;
}

// Guessing the Gmail address from a username now happens client-side (see
// lib/emailGuess.ts) so the list is ready to show instantly — this route
// only does the part that needs a server: paid validation against listclean.
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const apiKey =
    typeof body?.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : undefined;
  const candidates = parseCandidates(body?.candidates).slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "Provide a non-empty list of username/email pairs" },
      { status: 400 }
    );
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

  let results: ValidatedEmail[];
  try {
    const validations = await verifyEmailsBulk(
      candidates.map((c) => c.email),
      apiKey
    );
    const byEmail = new Map(validations.map((v) => [v.email, v]));
    results = candidates.map((c) => {
      const v = byEmail.get(c.email);
      return {
        username: c.username,
        email: c.email,
        status: v?.status ?? "unknown",
        reason: v?.reason,
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
        description: `Validated ${results.length} email${results.length === 1 ? "" : "s"} with listclean`,
        metadata: { tool: "emailValidator", count: results.length },
      });
      balance = wallet.balance;
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return NextResponse.json(
          {
            error: "Balance ran out mid-run. Results below were still validated.",
            code: "insufficient_balance",
            results,
          },
          { status: 402 }
        );
      }
      throw err;
    }
  }

  return NextResponse.json({ results, balance });
}
