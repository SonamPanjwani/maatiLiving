import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

// Secret-key client: bypasses RLS. Server-only — use solely for guest checkout writes,
// payment confirmation and order lookups by access token. Never for admin UI reads.
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && secretKey);

let client;

export function getSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured) throw new Error("SUPABASE_SECRET_KEY is not set");
  client ??= createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
