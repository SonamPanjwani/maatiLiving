import "server-only";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { isPayable, vendorBalance } from "@/src/lib/books/purchases";

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
const PURCHASE_MONEY_COLUMNS = "id, vendor_id, number, status, order_date, bill_number, due_date, total_paise";

// Balance due = opening balance + received/billed purchases (payments subtract from Phase 3).
function withPurchaseFigures(vendor, purchases) {
  const own = purchases.filter((purchase) => purchase.vendor_id === vendor.id);
  const payable = own.filter(isPayable);
  return {
    ...vendor,
    balancePaise: vendorBalance(vendor.opening_balance_paise, own),
    purchasedPaise: payable.reduce((sum, purchase) => sum + purchase.total_paise, 0),
    lastPurchaseDate: own.filter((purchase) => purchase.status !== "cancelled").map((purchase) => purchase.order_date).sort().at(-1) ?? null,
  };
}

export async function booksGetVendors({ q, status = "active", sort = "name" } = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase.from("vendors").select(VENDOR_LIST_COLUMNS).eq("status", status === "archived" ? "archived" : "active");
  const term = searchTerm(q);
  if (term) query = query.or(["name", "phone", "city", "supplies", "contact_person"].map((column) => `${column}.ilike.%${term}%`).join(","));
  const [rows, purchases] = await Promise.all([
    query.order("name").limit(500).then(unwrap),
    supabase.from("purchases").select(PURCHASE_MONEY_COLUMNS).neq("status", "cancelled").limit(5000).then(unwrap),
  ]);
  const vendors = rows.map((row) => withPurchaseFigures(row, purchases));
  if (sort === "balance") vendors.sort((a, b) => b.balancePaise - a.balancePaise || a.name.localeCompare(b.name));
  return vendors;
}

export async function booksGetVendor(id) {
  const supabase = createSupabaseServerClient();
  const vendor = unwrap(await supabase.from("vendors").select("*").eq("id", id).maybeSingle());
  if (!vendor) return null;
  const [products, purchases] = await Promise.all([
    supabase.from("vendor_products")
      .select("id, product_id, vendor_sku, last_cost_paise, is_preferred, products(name, slug, stock, price_paise, cost_price_paise)")
      .eq("vendor_id", id).order("created_at").then(unwrap),
    supabase.from("purchases").select(`${PURCHASE_MONEY_COLUMNS}, bill_date, expected_date`)
      .eq("vendor_id", id).order("order_date", { ascending: false }).order("created_at", { ascending: false }).limit(500).then(unwrap),
  ]);
  return { ...withPurchaseFigures(vendor, purchases), products, purchases };
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

// ---------------------------------------------------------------- purchases

export const PURCHASE_STATUSES = ["draft", "ordered", "partially_received", "received", "cancelled"];

const PURCHASE_LIST_COLUMNS = "id, number, status, order_date, expected_date, bill_number, bill_date, due_date, total_paise, created_at, vendor:vendor_id(id, name), purchase_items(qty_ordered, qty_received)";

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));

export async function booksGetPurchases({ status, vendorId, from, to, q } = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase.from("purchases").select(PURCHASE_LIST_COLUMNS);
  if (PURCHASE_STATUSES.includes(status)) query = query.eq("status", status);
  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (isDate(from)) query = query.gte("order_date", from);
  if (isDate(to)) query = query.lte("order_date", to);
  const term = searchTerm(q);
  if (term) query = query.or(`number.ilike.%${term}%,bill_number.ilike.%${term}%`);
  const rows = unwrap(await query.order("order_date", { ascending: false }).order("created_at", { ascending: false }).limit(500));
  return rows.map((row) => ({
    ...row,
    qtyOrdered: row.purchase_items.reduce((sum, item) => sum + item.qty_ordered, 0),
    qtyReceived: row.purchase_items.reduce((sum, item) => sum + item.qty_received, 0),
  }));
}

// Number of purchases per status, for the list tabs.
export async function booksGetPurchaseCounts() {
  const rows = unwrap(await createSupabaseServerClient().from("purchases").select("status").limit(10000));
  return rows.reduce((counts, row) => ({ ...counts, [row.status]: (counts[row.status] ?? 0) + 1 }), {});
}

export async function booksGetPurchase(id) {
  const supabase = createSupabaseServerClient();
  const purchase = unwrap(await supabase.from("purchases")
    .select("*, vendor:vendor_id(id, name, contact_person, phone, whatsapp, address, city, state, gstin, upi_id, payment_terms_days, status), items:purchase_items(id, product_id, qty_ordered, qty_received, unit_cost_paise, tax_rate, line_total_paise, landed_unit_cost_paise, sort_order, product:product_id(name, sku, slug, stock))")
    .eq("id", id).maybeSingle());
  if (!purchase) return null;
  const receipts = unwrap(await supabase.from("stock_movements")
    .select("id, product_id, qty_change, unit_cost_paise, note, created_at")
    .eq("ref_type", "purchase").eq("ref_id", id).order("created_at"));
  purchase.items.sort((a, b) => a.sort_order - b.sort_order);
  const locked = purchase.status === "partially_received" || purchase.status === "received" || purchase.items.some((item) => item.qty_received > 0);
  return { ...purchase, receipts, locked, editable: !locked && purchase.status !== "cancelled" };
}

// Everything the purchase form needs: vendors, products, and each vendor's last price per product.
export async function booksGetPurchaseFormData({ includeVendorId } = {}) {
  const supabase = createSupabaseServerClient();
  const [vendors, products, links] = await Promise.all([
    supabase.from("vendors").select("id, name, payment_terms_days, status").order("name").then(unwrap),
    supabase.from("products").select("id, name, sku, stock").order("name").then(unwrap),
    supabase.from("vendor_products").select("vendor_id, product_id, last_cost_paise, is_preferred").then(unwrap),
  ]);
  return {
    vendors: vendors.filter((vendor) => vendor.status === "active" || vendor.id === includeVendorId),
    products,
    links,
  };
}
