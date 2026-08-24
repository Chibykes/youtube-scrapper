import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — full read/write access, bypasses RLS. Never import
// this from a client component; wallet tables have no RLS policies at all,
// so the anon key can't touch them and this key must stay server-only.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { persistSession: false } },
);
