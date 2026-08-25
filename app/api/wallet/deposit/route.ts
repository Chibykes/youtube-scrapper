import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { initializeTransaction } from "@/network/paystack";
import { getYoseToNgnRate } from "@/lib/pricing";

const MIN_DEPOSIT_NGN = 100;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const amountNgn = Number(body?.amountNgn);

  if (!Number.isFinite(amountNgn) || amountNgn < MIN_DEPOSIT_NGN) {
    return NextResponse.json(
      { error: `Minimum deposit is ₦${MIN_DEPOSIT_NGN}` },
      { status: 400 }
    );
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return NextResponse.json(
      { error: "Your account has no verified email on file" },
      { status: 400 }
    );
  }

  const rate = getYoseToNgnRate();
  const yoseAmount = amountNgn / rate;
  const reference = `yose_dep_${userId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    const { authorizationUrl } = await initializeTransaction({
      email,
      amountKobo: Math.round(amountNgn * 100),
      reference,
      callbackUrl: new URL(
        "/dashboard/wallet/callback",
        request.url
      ).toString(),
      metadata: { userId, yoseAmount, rate },
    });

    return NextResponse.json({ authorizationUrl, reference });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to start deposit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
