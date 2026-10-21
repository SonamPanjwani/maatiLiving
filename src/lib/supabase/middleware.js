import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./config";

// Refreshes the auth cookie and returns the signed-in user id (or null). getClaims verifies the JWT locally
// (asymmetric signing keys) and refreshes an expired session, so this needs no round trip on most requests.
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const user = !error && data?.claims?.sub ? { id: data.claims.sub } : null;
  return { response, user };
}
