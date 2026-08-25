export type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

export type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    customer?: { email: string };
    metadata: Record<string, unknown> | null;
  };
};

export type InitializeTransactionParams = {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export type InitializeTransactionResult = {
  authorizationUrl: string;
  reference: string;
};

export type VerifyTransactionResult = {
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amountKobo: number;
  currency: string;
  customerEmail: string;
  metadata: Record<string, unknown> | null;
};
