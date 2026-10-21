"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/src/lib/auth";
import { booksGetInventory } from "@/src/lib/books/data";
import { validatePurchase } from "@/src/lib/books/purchases";
import { reorderGroups } from "@/src/lib/books/reorder";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Purchase actions. Every one starts with assertAdmin(); the SQL functions check is_admin() again and do all
// writes in one transaction (they RAISE on any problem, so nothing half-saves). Writes go through the signed-in
// session, so audit_log records the admin's user id.

const text = (formData, key) => String(formData.get(key) ?? "").trim();
const purchaseUrl = (id, params = {}) => `/admin/books/purchases/${id}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`;

function friendly(error) {
  if (error.code === "42501") return "Not authorised.";
  if (error.code === "23514") return "Some details aren't in the right format. Please check and try again.";
  if (error.code === "22007" || error.code === "22008") return "Please enter valid dates.";
  return error.message;
}

function refresh() {
  revalidatePath("/admin", "layout");
}

// Create or edit. Before anything is received: everything. After: bill details, files and notes only.
export async function savePurchase(_prevState, formData) {
  await assertAdmin();
  const id = text(formData, "id") || null;
  const locked = text(formData, "locked") === "1";
  const { vendorId, header, items, error } = validatePurchase(Object.fromEntries(formData), { locked: Boolean(id) && locked });
  if (error) return { error };

  const { data, error: saveError } = await createSupabaseServerClient().rpc("books_save_purchase", {
    p_id: id, p_vendor_id: vendorId, p_header: header, p_items: items,
  });
  if (saveError) return { error: friendly(saveError) };
  refresh();
  redirect(purchaseUrl(data, { saved: id ? "updated" : header.mark_ordered ? "ordered" : "created" }));
}

export async function markPurchaseOrdered(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const { error } = await createSupabaseServerClient().rpc("books_mark_purchase_ordered", { p_id: id });
  if (error) redirect(purchaseUrl(id, { error: friendly(error) }));
  refresh();
  redirect(purchaseUrl(id, { saved: "ordered" }));
}

export async function cancelPurchase(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const reason = text(formData, "reason");
  if (reason.length < 3) redirect(purchaseUrl(id, { error: "Please give a short reason for cancelling." }));
  const { error } = await createSupabaseServerClient().rpc("books_cancel_purchase", { p_id: id, p_reason: reason.slice(0, 300) });
  if (error) redirect(purchaseUrl(id, { error: friendly(error) }));
  refresh();
  redirect(purchaseUrl(id, { saved: "cancelled" }));
}

// Receive items: qty_<itemId> fields; allowOver=1 only after the admin confirmed receiving more than ordered.
export async function receivePurchase(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const back = (params) => `/admin/books/purchases/${id}/receive?${new URLSearchParams(params)}`;
  const lines = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const raw = String(value).trim();
    if (raw === "") continue;
    const qty = Number(raw);
    if (!Number.isInteger(qty) || qty < 0 || qty > 100000) redirect(back({ error: "Received quantities must be whole numbers, 0 or more." }));
    if (qty > 0) lines.push({ item_id: key.slice(4), qty });
  }
  if (lines.length === 0) redirect(back({ error: "Enter how many pieces arrived for at least one item." }));

  const { data: status, error } = await createSupabaseServerClient().rpc("books_receive_purchase", {
    p_id: id, p_lines: lines, p_note: text(formData, "note").slice(0, 300) || null, p_allow_over: text(formData, "allowOver") === "1",
  });
  if (error) redirect(back({ error: friendly(error) }));
  revalidatePath("/", "layout"); // stock changed: storefront availability too
  redirect(purchaseUrl(id, { saved: status === "received" ? "received" : "partly" }));
}

// Draft purchase for one vendor from everything low on stock that they're the preferred vendor for.
// Quantities and costs are recomputed here from the live data (never trusted from the page).
export async function createReorderDraft(formData) {
  await assertAdmin();
  const vendorId = text(formData, "vendorId");
  const [products, links] = await Promise.all([
    booksGetInventory(),
    createSupabaseServerClient().from("vendor_products").select("vendor_id, product_id, last_cost_paise").eq("vendor_id", vendorId).then(({ data }) => data ?? []),
  ]);
  const group = reorderGroups(products, links).groups.find((g) => g.vendor.id === vendorId);
  if (!group?.lines.length) redirect(`/admin/inventory?${new URLSearchParams({ low: "1", error: "Nothing low on stock with a known price for this vendor." })}`);
  const { data, error } = await createSupabaseServerClient().rpc("books_save_purchase", {
    p_id: null,
    p_vendor_id: vendorId,
    p_header: { notes: "Reorder draft from low stock. Check quantities and prices before sending." },
    p_items: group.lines.map((line) => ({ product_id: line.productId, qty: line.qty, unit_cost_paise: line.unitCostPaise })),
  });
  if (error) redirect(`/admin/inventory?${new URLSearchParams({ low: "1", error: friendly(error) })}`);
  refresh();
  redirect(`/admin/books/purchases/${data}/edit?reorder=1`);
}
