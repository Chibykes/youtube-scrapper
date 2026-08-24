import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { creditWallet } from "@/lib/wallet";

// Paystack calls this directly — no Clerk session, so this route must stay
// out of proxy.ts's protected matcher. Authenticity comes from the
// x-paystack-signature header instead (HMAC-SHA512 of the raw body with
// the secret key), not from a logged-in user.
export async function POST(request: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const isValid =
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const data = event.data;
    const userId = data.metadata?.userId;
    const yoseAmount = Number(data.metadata?.yoseAmount);

    if (userId && Number.isFinite(yoseAmount) && yoseAmount > 0) {
      await creditWallet({
        userId,
        amount: yoseAmount,
        description: "Paystack deposit",
        reference: data.reference,
        metadata: { amountKobo: data.amount, currency: data.currency },
      });
    }
  }

  return NextResponse.json({ received: true });
}
