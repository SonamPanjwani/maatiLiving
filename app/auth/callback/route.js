import { NextResponse } from "next/server";
import { safeNextPath } from "@/src/lib/auth";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Landing point for Supabase email links (sign-up confirmation, password reset).
// Exchanges the one-time code for a session cookie, then continues to ?next=.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/account");

  if (code) {
    const { error } = await createSupabaseServerClient().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/account/login?error=link`);
}
