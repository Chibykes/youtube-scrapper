import "server-only";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

type InitializeTransactionResult = {
  authorizationUrl: string;
  reference: string;
};

export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeTransactionResult> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      currency: "NGN",
      metadata: params.metadata,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message ?? "Failed to initialize Paystack transaction");
  }

  return {
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
}

export type VerifyTransactionResult = {
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amountKobo: number;
  currency: string;
  customerEmail: string;
  metadata: Record<string, unknown> | null;
};

export async function verifyTransaction(
  reference: string,
): Promise<VerifyTransactionResult> {
  const res = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${getSecretKey()}` } },
  );

  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message ?? "Failed to verify Paystack transaction");
  }

  return {
    status: data.data.status,
    reference: data.data.reference,
    amountKobo: data.data.amount,
    currency: data.data.currency,
    customerEmail: data.data.customer?.email,
    metadata: data.data.metadata ?? null,
  };
}
