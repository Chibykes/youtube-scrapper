import { NextRequest, NextResponse } from "next/server";
import { usernamesToEmailCandidates } from "@/lib/emailGuess";
import { validateEmail } from "@/lib/mailsSo";
import { mapWithConcurrency } from "@/lib/youtube";

export const maxDuration = 60;

const MAX_USERNAMES = 500;

type ConvertedEmail = {
  username: string;
  email: string;
  status: "valid" | "invalid" | "unknown";
  reason?: string;
};

export async function POST(request: NextRequest) {
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

  return NextResponse.json({ results });
}
