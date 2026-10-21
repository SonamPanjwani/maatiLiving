import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

// Who is signed in. The session JWT is verified locally (getClaims: the project signs with asymmetric ES256 keys,
// so no round trip to Supabase Auth), then the profile — and so the role — is read from the database every time,
// so removing someone's admin role takes effect on their next request. cache(): one check per request, shared by
// the layout, the page and anything else that asks.
const readClaimsUser = cache(async () => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: claims.email ?? null };
});

// The full user record from Supabase Auth (a network round trip). Only for decisions that need fields the token
// doesn't carry: email_confirmed_at (linking guest orders) and recovery_sent_at (password reset window).
const readVerifiedUser = cache(async () => {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser();
  return user ?? null;
});

const readProfile = cache(async (userId) => {
  const { data: profile } = await createSupabaseServerClient().from("profiles").select("id, email, full_name, phone, role").eq("id", userId).single();
  return profile ?? null;
});

// Returns { user, profile } for the signed-in user, or null. { verified: true } returns the full Auth user record.
export async function getCurrentUser({ verified = false } = {}) {
  if (!isSupabaseConfigured) return null;
  const user = verified ? await readVerifiedUser() : await readClaimsUser();
  if (!user) return null;
  return { user, profile: await readProfile(user.id) };
}

// Only same-site paths are allowed as post-login destinations (blocks open redirects like //evil.com).
export function safeNextPath(value, fallback = "/account") {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : fallback;
}

// For customer account pages: any signed-in user (admins can shop too).
export async function requireCustomerPage(next = "/account", { verified = false } = {}) {
  const current = await getCurrentUser({ verified });
  if (!current) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return current;
}

// For customer server actions.
export async function assertSignedIn({ verified = false } = {}) {
  const current = await getCurrentUser({ verified });
  if (!current) throw new Error("Please sign in again.");
  return current;
}

export async function getCurrentAdmin() {
  const current = await getCurrentUser();
  return current?.profile?.role === "admin" ? current : null;
}

// For admin pages: redirect anyone who isn't an admin.
export async function requireAdminPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/admin/login");
  if (current.profile?.role !== "admin") redirect("/admin/login?error=not-admin");
  return current;
}

// For server actions and route handlers: throw instead of redirecting.
export async function assertAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authorised");
  return admin;
}
