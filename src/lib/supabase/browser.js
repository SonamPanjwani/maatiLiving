"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./config";

// Browser client: reads the same session cookie the server sets. Used only for small UI touches
// (e.g. the navbar greeting) so storefront pages can stay statically rendered.
let client;

export function getSupabaseBrowserClient() {
  client ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
