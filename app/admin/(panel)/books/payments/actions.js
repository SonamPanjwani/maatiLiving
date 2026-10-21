"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/src/lib/auth";
import { parseAllocationFields, validatePayment } from "@/src/lib/books/payments";
import { todayInIndia } from "@/src/lib/format";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Vendor payment actions. Every one starts with assertAdmin(); the SQL functions check is_admin() again, re-check
// every allocation against the live balances and write in one transaction (RAISE on any problem, so nothing
// half-saves). Writes go through the signed-in session, so audit_log records the admin's user id.

const text = (formData, key) => String(formData.get(key) ?? "").trim();
const paymentUrl = (id, params = {}) => `/admin/books/payments/${id}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`;

function friendly(error) {
  if (error.code === "42501") return "Not authorised.";
  if (error.code === "23514") return "Some details aren't in the right format. Please check and try again.";
  if (error.code === "22007" || error.code === "22008") return "Please enter a valid date.";
  return error.message;
}

const toRpc = (allocations) => allocations.map(({ purchase_id, amount_paise }) => ({ purchase_id, amount_paise }));

export async function recordPayment(_prevState, formData) {
  await assertAdmin();
  const { vendorId, payment, error } = validatePayment(Object.fromEntries(formData), { today: todayInIndia() });
  if (error) return { error };
  const { allocations, error: allocationError } = parseAllocationFields(formData.entries());
  if (allocationError) return { error: allocationError };

  const { data, error: saveError } = await createSupabaseServerClient().rpc("books_record_payment", {
    p_vendor_id: vendorId, p_payment: payment, p_allocations: toRpc(allocations),
  });
  if (saveError) return { error: friendly(saveError) };
  revalidatePath("/admin", "layout");
  redirect(paymentUrl(data, { saved: "recorded" }));
}

export async function updatePaymentAllocation(_prevState, formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const { allocations, error } = parseAllocationFields(formData.entries());
  if (error) return { error };
  const { error: saveError } = await createSupabaseServerClient().rpc("books_set_payment_allocations", { p_payment_id: id, p_allocations: toRpc(allocations) });
  if (saveError) return { error: friendly(saveError) };
  revalidatePath("/admin", "layout");
  redirect(paymentUrl(id, { saved: "allocated" }));
}

export async function voidPayment(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const reason = text(formData, "reason");
  if (reason.length < 3) redirect(paymentUrl(id, { error: "Please give a short reason for voiding." }));
  const { error } = await createSupabaseServerClient().rpc("books_void_payment", { p_id: id, p_reason: reason.slice(0, 300) });
  if (error) redirect(paymentUrl(id, { error: friendly(error) }));
  revalidatePath("/admin", "layout");
  redirect(paymentUrl(id, { saved: "voided" }));
}
