"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/src/lib/auth";
import { rupeesToPaise } from "@/src/lib/books/money";
import { validateVendor } from "@/src/lib/books/vendors";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Books server actions. Every one starts with assertAdmin(); RLS (is_admin) enforces the same in the DB,
// and all writes go through the signed-in session so audit_log records the admin's user id.

const text = (formData, key) => String(formData.get(key) ?? "").trim();
const vendorUrl = (id, params = {}) => `/admin/books/vendors/${id}?${new URLSearchParams(params)}`;

function friendly(error) {
  if (error.code === "23505") return "That product is already linked to this vendor.";
  if (error.code === "23514") return "Some details aren't in the right format. Please check and try again.";
  if (error.code === "42501") return "Not authorised.";
  return error.message;
}

// ---------------------------------------------------------------- vendors

export async function saveVendor(_prevState, formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const { row, error } = validateVendor(Object.fromEntries(formData));
  if (error) return { error };

  const supabase = createSupabaseServerClient();
  const { data, error: saveError } = id
    ? await supabase.from("vendors").update(row).eq("id", id).select("id").single()
    : await supabase.from("vendors").insert(row).select("id").single();
  if (saveError) return { error: friendly(saveError) };

  revalidatePath("/admin/books", "layout");
  redirect(vendorUrl(data.id, { saved: id ? "updated" : "created" }));
}

export async function archiveVendor(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const reason = text(formData, "reason");
  if (reason.length < 3) redirect(vendorUrl(id, { error: "Please give a short reason for archiving." }));
  const { error } = await createSupabaseServerClient().from("vendors").update({ status: "archived", archived_reason: reason }).eq("id", id);
  if (error) redirect(vendorUrl(id, { error: friendly(error) }));
  revalidatePath("/admin/books", "layout");
  redirect(vendorUrl(id, { saved: "archived" }));
}

export async function restoreVendor(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const { error } = await createSupabaseServerClient().from("vendors").update({ status: "active", archived_reason: null }).eq("id", id);
  if (error) redirect(vendorUrl(id, { error: friendly(error) }));
  revalidatePath("/admin/books", "layout");
  redirect(vendorUrl(id, { saved: "restored" }));
}

// ---------------------------------------------------------------- products supplied

export async function linkVendorProduct(formData) {
  await assertAdmin();
  const vendorId = text(formData, "vendorId");
  const productId = text(formData, "productId");
  const back = (params) => vendorUrl(vendorId, { tab: "products", ...params });
  if (!productId) redirect(back({ error: "Choose a product." }));
  const cost = rupeesToPaise(text(formData, "lastCost"));
  if (Number.isNaN(cost)) redirect(back({ error: "Cost must be an amount in rupees, e.g. 180 or 180.50." }));

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("vendor_products").insert({
    vendor_id: vendorId, product_id: productId, vendor_sku: text(formData, "vendorSku") || null, last_cost_paise: cost,
  });
  if (error) redirect(back({ error: friendly(error) }));
  if (formData.get("preferred") === "on") {
    const { error: prefError } = await supabase.rpc("books_set_preferred_vendor", { p_vendor_id: vendorId, p_product_id: productId });
    if (prefError) redirect(back({ error: friendly(prefError) }));
  }
  revalidatePath("/admin", "layout");
  redirect(back({ saved: "linked" }));
}

export async function setPreferredVendor(formData) {
  await assertAdmin();
  const vendorId = text(formData, "vendorId");
  const { error } = await createSupabaseServerClient().rpc("books_set_preferred_vendor", { p_vendor_id: vendorId, p_product_id: text(formData, "productId") });
  if (error) redirect(vendorUrl(vendorId, { tab: "products", error: friendly(error) }));
  revalidatePath("/admin", "layout");
  redirect(vendorUrl(vendorId, { tab: "products", saved: "preferred" }));
}

export async function updateVendorProduct(formData) {
  await assertAdmin();
  const vendorId = text(formData, "vendorId");
  const back = (params) => vendorUrl(vendorId, { tab: "products", ...params });
  const cost = rupeesToPaise(text(formData, "lastCost"));
  if (Number.isNaN(cost)) redirect(back({ error: "Cost must be an amount in rupees, e.g. 180 or 180.50." }));
  const { error } = await createSupabaseServerClient().from("vendor_products")
    .update({ vendor_sku: text(formData, "vendorSku") || null, last_cost_paise: cost })
    .eq("id", text(formData, "linkId")).eq("vendor_id", vendorId);
  if (error) redirect(back({ error: friendly(error) }));
  redirect(back({ saved: "link-updated" }));
}

// Unlinking only removes the "supplies this product" link (audited); purchase history is unaffected.
export async function unlinkVendorProduct(formData) {
  await assertAdmin();
  const vendorId = text(formData, "vendorId");
  const { error } = await createSupabaseServerClient().from("vendor_products").delete().eq("id", text(formData, "linkId")).eq("vendor_id", vendorId);
  if (error) redirect(vendorUrl(vendorId, { tab: "products", error: friendly(error) }));
  revalidatePath("/admin", "layout");
  redirect(vendorUrl(vendorId, { tab: "products", saved: "unlinked" }));
}
