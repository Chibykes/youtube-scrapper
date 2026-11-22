import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy so `next build` can import wallet routes without SUPABASE_* baked into
// the image. Runtime still needs real env (compose env_file / host .env.local).
let client: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required at runtime"
    );
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

// Service-role client — full read/write, bypasses RLS. Never import from a
// client component. Proxy keeps existing `supabaseAdmin.from(...)` call sites.
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getSupabaseAdmin(), prop, receiver);
    return typeof value === "function" ? value.bind(getSupabaseAdmin()) : value;
  },
});
