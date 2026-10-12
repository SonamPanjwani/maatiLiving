import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./config";

// Cookie-free anon client for public catalogue reads, so storefront pages stay statically renderable.
let client;

export function getSupabasePublicClient() {
  client ??= createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
