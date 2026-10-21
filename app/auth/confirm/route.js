import { NextResponse } from "next/server";
import { safeNextPath } from "@/src/lib/auth";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Landing point for the Maati Living auth email templates (docs/email-templates): verifies the one-time token
// from the link and signs the person in, then continues to ?next=. Unlike /auth/callback (code exchange), this
// works when the email is opened on a different phone or browser than the one the form was filled in on.
const TYPES = new Set(["email", "signup", "recovery", "email_change", "invite", "magiclink"]);

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"), type === "recovery" ? "/account/reset-password" : "/account");

  if (tokenHash && TYPES.has(type)) {
    const { error } = await createSupabaseServerClient().auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/account/login?error=link`);
}
