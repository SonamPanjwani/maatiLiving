import "server-only";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Admin reads for Books. All through the signed-in session client, so RLS (is_admin) applies.

export const DEFAULT_LOW_STOCK = 5;

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// Remove characters that have meaning in PostgREST filter syntax before an OR search.
const searchTerm = (q) => String(q ?? "").replace(/[%,()*\\:"']/g, " ").trim().slice(0, 60);

// ---------------------------------------------------------------- inventory

const INVENTORY_COLUMNS = "id, slug, name, sku, price_paise, stock, cost_price_paise, low_stock_threshold, is_available, category:category_id(name), vendor_products(is_preferred, vendors(id, name))";

function mapInventoryRow(row) {
  const preferred = row.vendor_products?.find((link) => link.is_preferred)?.vendors ?? null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sku: row.sku,
    pricePaise: row.price_paise,
    stock: row.stock,
    costPaise: row.cost_price_paise,
    lowStockAt: row.low_stock_threshold ?? DEFAULT_LOW_STOCK,
    hasOwnThreshold: row.low_stock_threshold != null,
    available: row.is_available,
    category: row.category?.name ?? null,
    preferredVendor: preferred,
    // Margin per piece and stock value; null when cost isn't set yet.
    marginPct: row.cost_price_paise != null && row.price_paise > 0 ? Math.round(((row.price_paise - row.cost_price_paise) / row.price_paise) * 1000) / 10 : null,
    valueAtCostPaise: row.cost_price_paise != null ? row.cost_price_paise * row.stock : null,
    valueAtPricePaise: row.price_paise * row.stock,
  };
}

export async function booksGetInventory() {
  const rows = unwrap(await createSupabaseServerClient().from("products").select(INVENTORY_COLUMNS).order("name"));
  return rows.map(mapInventoryRow);
}

export async function booksGetInventoryProduct(id) {
  const supabase = createSupabaseServerClient();
  const row = unwrap(await supabase.from("products").select(INVENTORY_COLUMNS).eq("id", id).maybeSingle());
  if (!row) return null;
  const movements = unwrap(await supabase.from("stock_movements")
    .select("id, qty_change, reason, adjustment_reason, ref_type, ref_id, unit_cost_paise, stock_after, note, created_at")
    .eq("product_id", id).order("created_at", { ascending: false }).limit(200));
  return { ...mapInventoryRow(row), movements };
}

// ---------------------------------------------------------------- vendors

const VENDOR_LIST_COLUMNS = "id, name, contact_person, phone, city, state, supplies, status, opening_balance_paise, created_at";

// Balance due = opening balance for now; purchases and payments join this in Phases 2–3.
export async function booksGetVendors({ q, status = "active", sort = "name" } = {}) {
  let query = createSupabaseServerClient().from("vendors").select(VENDOR_LIST_COLUMNS).eq("status", status === "archived" ? "archived" : "active");
  const term = searchTerm(q);
  if (term) query = query.or(["name", "phone", "city", "supplies", "contact_person"].map((column) => `${column}.ilike.%${term}%`).join(","));
  query = sort === "balance" ? query.order("opening_balance_paise", { ascending: false }).order("name") : query.order("name");
  const rows = unwrap(await query.limit(500));
  return rows.map((row) => ({ ...row, balancePaise: row.opening_balance_paise }));
}

export async function booksGetVendor(id) {
  const supabase = createSupabaseServerClient();
  const vendor = unwrap(await supabase.from("vendors").select("*").eq("id", id).maybeSingle());
  if (!vendor) return null;
  const products = unwrap(await supabase.from("vendor_products")
    .select("id, product_id, vendor_sku, last_cost_paise, is_preferred, products(name, slug, stock, price_paise, cost_price_paise)")
    .eq("vendor_id", id).order("created_at"));
  return { ...vendor, balancePaise: vendor.opening_balance_paise, products };
}

// Products not yet linked to this vendor (for the "add product supplied" picker).
export async function booksGetLinkableProducts(vendorId) {
  const supabase = createSupabaseServerClient();
  const [all, linked] = await Promise.all([
    supabase.from("products").select("id, name, sku").order("name").then(unwrap),
    supabase.from("vendor_products").select("product_id").eq("vendor_id", vendorId).then(unwrap),
  ]);
  const taken = new Set(linked.map((row) => row.product_id));
  return all.filter((product) => !taken.has(product.id));
}
