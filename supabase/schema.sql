-- YT Scraper wallet schema.
-- Run this once in the Supabase SQL editor (or `supabase db push` if you
-- wire up the CLI). Safe to re-run — every statement is idempotent.
--
-- Money never touches the client: all balance changes go through the
-- credit_wallet / debit_wallet functions below, called from server-only
-- code with the service role key. RLS is enabled with no policies, so the
-- anon/public key can't read or write these tables at all.

create extension if not exists pgcrypto;

create table if not exists wallets (
  user_id text primary key,
  balance numeric(18, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references wallets (user_id),
  type text not null check (type in ('deposit', 'debit')),
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  amount numeric(18, 2) not null check (amount > 0),
  balance_after numeric(18, 2) not null,
  description text not null,
  reference text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_transactions_reference_key
  on wallet_transactions (reference)
  where reference is not null;

create index if not exists wallet_transactions_user_id_created_at_idx
  on wallet_transactions (user_id, created_at desc);

alter table wallets enable row level security;
alter table wallet_transactions enable row level security;

-- Credits a wallet (e.g. a verified Paystack deposit). Idempotent on
-- `p_reference` — calling it twice with the same reference (webhook retry
-- + redirect callback both firing) only credits once.
create or replace function credit_wallet(
  p_user_id text,
  p_amount numeric,
  p_description text,
  p_reference text default null,
  p_metadata jsonb default null
) returns wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet wallets;
begin
  if p_reference is not null and exists (
    select 1 from wallet_transactions where reference = p_reference
  ) then
    select * into v_wallet from wallets where user_id = p_user_id;
    return v_wallet;
  end if;

  insert into wallets (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

  update wallets
    set balance = balance + p_amount, updated_at = now()
    where user_id = p_user_id
    returning * into v_wallet;

  insert into wallet_transactions
    (user_id, type, status, amount, balance_after, description, reference, metadata)
  values
    (p_user_id, 'deposit', 'completed', p_amount, v_wallet.balance, p_description, p_reference, p_metadata);

  return v_wallet;
end;
$$;

-- security definer functions run as their owner, which bypasses RLS on the
-- tables they touch — so the only thing actually gating access is who can
-- call the function at all. Postgres grants EXECUTE to PUBLIC by default,
-- which would let the anon/publishable key move money. Lock that down.
revoke execute on function credit_wallet(text, numeric, text, text, jsonb) from public, anon, authenticated;
grant execute on function credit_wallet(text, numeric, text, text, jsonb) to service_role;

-- Debits a wallet (e.g. paying for a tool run). Raises `insufficient_balance`
-- if the wallet doesn't have enough — the update's WHERE clause makes the
-- balance check and the deduction atomic, so concurrent debits can't push
-- the balance negative.
create or replace function debit_wallet(
  p_user_id text,
  p_amount numeric,
  p_description text,
  p_metadata jsonb default null
) returns wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet wallets;
begin
  insert into wallets (user_id) values (p_user_id)
    on conflict (user_id) do nothing;

  update wallets
    set balance = balance - p_amount, updated_at = now()
    where user_id = p_user_id and balance >= p_amount
    returning * into v_wallet;

  if v_wallet is null then
    raise exception 'insufficient_balance';
  end if;

  insert into wallet_transactions
    (user_id, type, status, amount, balance_after, description, metadata)
  values
    (p_user_id, 'debit', 'completed', p_amount, v_wallet.balance, p_description, p_metadata);

  return v_wallet;
end;
$$;

revoke execute on function debit_wallet(text, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function debit_wallet(text, numeric, text, jsonb) to service_role;
