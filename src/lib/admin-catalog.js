// Admin reads go through the signed-in session so RLS also returns hidden products.
import { CATEGORY_COLUMNS, PRODUCT_COLUMNS, mapCategory, mapProduct } from "./catalog";
import { createSupabaseServerClient } from "./supabase/server";

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

export async function adminGetCategories() {
  const rows = unwrap(await createSupabaseServerClient().from("categories").select(CATEGORY_COLUMNS).order("sort_order").order("name"));
  return rows.map(mapCategory);
}

export async function adminGetProducts() {
  const rows = unwrap(await createSupabaseServerClient().from("products").select(PRODUCT_COLUMNS).order("created_at", { ascending: false }));
  return rows.map(mapProduct);
}

export async function adminGetProduct(id) {
  const row = unwrap(await createSupabaseServerClient().from("products").select(PRODUCT_COLUMNS).eq("id", id).maybeSingle());
  return row ? mapProduct(row) : null;
}

export async function adminCountProductsByCategory() {
  const rows = unwrap(await createSupabaseServerClient().from("products").select("category_id"));
  return rows.reduce((counts, row) => ({ ...counts, [row.category_id]: (counts[row.category_id] ?? 0) + 1 }), {});
}
