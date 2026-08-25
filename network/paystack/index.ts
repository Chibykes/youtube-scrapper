import "server-only";
import { createHttpClient } from "@/network/httpClient";
import type {
  InitializeTransactionParams,
  InitializeTransactionResult,
  PaystackInitializeResponse,
  PaystackVerifyResponse,
  VerifyTransactionResult,
} from "@/network/paystack/types";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getSecretKey()}` };
}

const paystackApi = createHttpClient({ baseURL: "https://api.paystack.co" });

export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<InitializeTransactionResult> {
  const res = await paystackApi.post<PaystackInitializeResponse>(
    "/transaction/initialize",
    {
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      currency: "NGN",
      metadata: params.metadata,
    },
    { headers: authHeaders() }
  );

  const data = res.data;
  if (res.status >= 400 || !data.status) {
    throw new Error(
      data.message ?? "Failed to initialize Paystack transaction"
    );
  }

  return {
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
}

export async function verifyTransaction(
  reference: string
): Promise<VerifyTransactionResult> {
  const res = await paystackApi.get<PaystackVerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: authHeaders() }
  );

  const data = res.data;
  if (res.status >= 400 || !data.status) {
    throw new Error(data.message ?? "Failed to verify Paystack transaction");
  }

  return {
    status: data.data.status,
    reference: data.data.reference,
    amountKobo: data.data.amount,
    currency: data.data.currency,
    customerEmail: data.data.customer?.email ?? "",
    metadata: data.data.metadata ?? null,
  };
}
