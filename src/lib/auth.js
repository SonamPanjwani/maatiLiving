import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

// Returns { user, profile } for the signed-in user, or null.
export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name, phone, role").eq("id", user.id).single();
  return { user, profile };
}

// Only same-site paths are allowed as post-login destinations (blocks open redirects like //evil.com).
export function safeNextPath(value, fallback = "/account") {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : fallback;
}

// For customer account pages: any signed-in user (admins can shop too).
export async function requireCustomerPage(next = "/account") {
  const current = await getCurrentUser();
  if (!current) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return current;
}

// For customer server actions.
export async function assertSignedIn() {
  const current = await getCurrentUser();
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
