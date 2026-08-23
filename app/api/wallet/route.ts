import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBalance } from "@/lib/wallet";
import { CURRENCY, getYoseToNgnRate } from "@/lib/pricing";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const balance = await getBalance(userId);
  return NextResponse.json({
    balance,
    currency: CURRENCY,
    ngnRate: getYoseToNgnRate(),
  });
}
