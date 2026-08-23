import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export type Wallet = {
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
};

export type WalletTransaction = {
  id: string;
  user_id: string;
  type: "deposit" | "debit";
  status: "pending" | "completed" | "failed";
  amount: number;
  balance_after: number;
  description: string;
  reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Insufficient balance");
    this.name = "InsufficientBalanceError";
  }
}

export async function getBalance(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.balance ?? 0;
}

export async function listTransactions(
  userId: string,
  limit = 50,
): Promise<WalletTransaction[]> {
  const { data, error } = await supabaseAdmin
    .from("wallet_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function creditWallet(params: {
  userId: string;
  amount: number;
  description: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}): Promise<Wallet> {
  const { data, error } = await supabaseAdmin.rpc("credit_wallet", {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_description: params.description,
    p_reference: params.reference ?? null,
    p_metadata: params.metadata ?? null,
  });

  if (error) throw error;
  return data as Wallet;
}

export async function debitWallet(params: {
  userId: string;
  amount: number;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<Wallet> {
  const { data, error } = await supabaseAdmin.rpc("debit_wallet", {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_description: params.description,
    p_metadata: params.metadata ?? null,
  });

  if (error) {
    if (error.message.includes("insufficient_balance")) {
      throw new InsufficientBalanceError();
    }
    throw error;
  }
  return data as Wallet;
}
