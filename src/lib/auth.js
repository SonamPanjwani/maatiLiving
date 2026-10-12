import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

// Returns { user, profile } for the signed-in user, or null.
export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name, role").eq("id", user.id).single();
  return { user, profile };
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
