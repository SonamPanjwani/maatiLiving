"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSignedIn, safeNextPath } from "@/src/lib/auth";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { clean, isValidEmail, isValidPhone, normalisePhone, validateAddress } from "@/src/lib/validation";

const text = (formData, key) => String(formData.get(key) ?? "").trim();

// Absolute base URL for links inside Supabase emails.
function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

function passwordProblem(password) {
  if (password.length < 8) return "Use at least 8 characters for your password.";
  return null;
}

// ---------------------------------------------------------------------------
// Sign up / in / out
// ---------------------------------------------------------------------------

export async function signUpCustomer(_prevState, formData) {
  const name = clean(formData.get("name"), 120);
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2) return { error: "Please enter your name." };
  if (!isValidEmail(email)) return { error: "Please enter a valid email address." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const next = safeNextPath(formData.get("next"));
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name }, emailRedirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: error.message.includes("signups not allowed") ? "New accounts aren't open yet." : "We couldn't create your account. Please try again." };
  if (data.session) redirect(next); // email confirmation turned off in Supabase
  return { sent: email };
}

export async function signInCustomer(_prevState, formData) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: text(formData, "email").toLowerCase(), password: String(formData.get("password") ?? "") });
  if (error) {
    if (/not confirmed/i.test(error.message)) return { error: "Please confirm your email first — check your inbox for our link." };
    return { error: "Email or password is incorrect." };
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function signOutCustomer() {
  await createSupabaseServerClient().auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export async function requestPasswordReset(_prevState, formData) {
  const email = text(formData, "email").toLowerCase();
  if (!isValidEmail(email)) return { error: "Please enter a valid email address." };
  await createSupabaseServerClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${siteOrigin()}/auth/callback?next=/account/reset-password`,
  });
  // Same answer whether or not the account exists, so emails can't be probed.
  return { sent: email };
}

export async function updatePassword(_prevState, formData) {
  await assertSignedIn();
  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const { error } = await createSupabaseServerClient().auth.updateUser({ password });
  if (error) return { error: "We couldn't update your password. Please request a new reset link." };
  redirect("/account/profile?password=updated");
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function updateProfile(_prevState, formData) {
  const { user } = await assertSignedIn();
  const fullName = clean(formData.get("name"), 120);
  const phone = normalisePhone(formData.get("phone"));
  if (fullName.length < 2) return { error: "Please enter your name." };
  if (phone && !isValidPhone(phone)) return { error: "Please enter a 10-digit Indian mobile number, or leave it blank." };

  const { error } = await createSupabaseServerClient().from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", user.id);
  if (error) return { error: "We couldn't save your details. Please try again." };
  revalidatePath("/account", "layout");
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Addresses (RLS limits every query to the signed-in user's rows)
// ---------------------------------------------------------------------------

async function clearDefault(supabase, userId) {
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId).eq("is_default", true);
}

export async function saveAddress(_prevState, formData) {
  const { user } = await assertSignedIn();
  const { address, error } = validateAddress(Object.fromEntries(formData));
  if (error) return { error };

  const supabase = createSupabaseServerClient();
  const id = text(formData, "id");
  const makeDefault = formData.get("isDefault") === "on";
  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true });
  const isDefault = makeDefault || (!id && !count); // first address becomes the default
  if (isDefault) await clearDefault(supabase, user.id);

  const row = { ...address, is_default: isDefault };
  const { error: saveError } = id
    ? await supabase.from("addresses").update(row).eq("id", id)
    : await supabase.from("addresses").insert(row);
  if (saveError) return { error: "We couldn't save this address. Please try again." };

  revalidatePath("/account/addresses");
  redirect("/account/addresses?saved=1");
}

export async function deleteAddress(formData) {
  await assertSignedIn();
  await createSupabaseServerClient().from("addresses").delete().eq("id", text(formData, "id"));
  revalidatePath("/account/addresses");
  redirect("/account/addresses");
}

export async function setDefaultAddress(formData) {
  const { user } = await assertSignedIn();
  const supabase = createSupabaseServerClient();
  await clearDefault(supabase, user.id);
  await supabase.from("addresses").update({ is_default: true }).eq("id", text(formData, "id"));
  revalidatePath("/account/addresses");
  redirect("/account/addresses");
}
