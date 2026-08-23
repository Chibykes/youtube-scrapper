import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listTransactions } from "@/lib/wallet";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transactions = await listTransactions(userId);
  return NextResponse.json({ transactions });
}
