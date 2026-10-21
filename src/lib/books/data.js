import "server-only";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { openItems, purchasePayState, unallocatedPayments, vendorStatement } from "@/src/lib/books/payments";
import { isPayable, vendorBalance } from "@/src/lib/books/purchases";
import { todayInIndia } from "@/src/lib/format";

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
const PURCHASE_MONEY_COLUMNS = "id, vendor_id, number, status, order_date, bill_number, bill_date, due_date, total_paise, created_at";
const PAYMENT_MONEY_COLUMNS = "id, vendor_id, number, amount_paise, paid_on, method, reference, status, created_at";
const ALLOCATION_COLUMNS = "id, payment_id, purchase_id, amount_paise, payment:payment_id(status, vendor_id)";

// Every allocation with its payment's status/vendor (small shop: one read, filtered in JS).
const allAllocations = (supabase) => supabase.from("vendor_payment_allocations").select(ALLOCATION_COLUMNS).limit(20000).then(unwrap);

// Balance due = opening balance + received/billed purchases − active payments; plus overdue bills.
function withMoneyFigures(vendor, purchases, payments, allocations, today) {
  const own = purchases.filter((purchase) => purchase.vendor_id === vendor.id);
  const ownPayments = payments.filter((payment) => payment.vendor_id === vendor.id);
  const ownAllocations = allocations.filter((allocation) => allocation.payment?.vendor_id === vendor.id);
  const items = openItems({ openingBalancePaise: vendor.opening_balance_paise, purchases: own, allocations: ownAllocations, today });
  const overdue = items.filter((item) => item.overdueDays > 0);
  return {
    ...vendor,
    balancePaise: vendorBalance(vendor.opening_balance_paise, own, ownPayments),
    purchasedPaise: own.filter(isPayable).reduce((sum, purchase) => sum + purchase.total_paise, 0),
    paidPaise: ownPayments.filter((payment) => payment.status === "active").reduce((sum, payment) => sum + payment.amount_paise, 0),
    overdueCount: overdue.length,
    overduePaise: overdue.reduce((sum, item) => sum + item.balancePaise, 0),
    openItems: items,
    lastPurchaseDate: own.filter((purchase) => purchase.status !== "cancelled").map((purchase) => purchase.order_date).sort().at(-1) ?? null,
  };
}

export async function booksGetVendors({ q, status = "active", sort = "name" } = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase.from("vendors").select(VENDOR_LIST_COLUMNS).eq("status", status === "archived" ? "archived" : "active");
  const term = searchTerm(q);
  if (term) query = query.or(["name", "phone", "city", "supplies", "contact_person"].map((column) => `${column}.ilike.%${term}%`).join(","));
  const [rows, purchases, payments, allocations] = await Promise.all([
    query.order("name").limit(500).then(unwrap),
    supabase.from("purchases").select(PURCHASE_MONEY_COLUMNS).neq("status", "cancelled").limit(5000).then(unwrap),
    supabase.from("vendor_payments").select(PAYMENT_MONEY_COLUMNS).eq("status", "active").limit(5000).then(unwrap),
    allAllocations(supabase),
  ]);
  const today = todayInIndia();
  const vendors = rows.map((row) => withMoneyFigures(row, purchases, payments, allocations, today));
  if (sort === "balance") vendors.sort((a, b) => b.balancePaise - a.balancePaise || a.name.localeCompare(b.name));
  return vendors;
}

export async function booksGetVendor(id) {
  const supabase = createSupabaseServerClient();
  const vendor = unwrap(await supabase.from("vendors").select("*").eq("id", id).maybeSingle());
  if (!vendor) return null;
  const [products, purchases, payments, allocations] = await Promise.all([
    supabase.from("vendor_products")
      .select("id, product_id, vendor_sku, last_cost_paise, is_preferred, products(name, slug, stock, price_paise, cost_price_paise)")
      .eq("vendor_id", id).order("created_at").then(unwrap),
    supabase.from("purchases").select(`${PURCHASE_MONEY_COLUMNS}, expected_date`)
      .eq("vendor_id", id).order("order_date", { ascending: false }).order("created_at", { ascending: false }).limit(500).then(unwrap),
    supabase.from("vendor_payments").select(`${PAYMENT_MONEY_COLUMNS}, void_reason, allocations:vendor_payment_allocations(purchase_id, amount_paise)`)
      .eq("vendor_id", id).order("paid_on", { ascending: false }).order("created_at", { ascending: false }).limit(500).then(unwrap),
    allAllocations(supabase),
  ]);
  const today = todayInIndia();
  const ownAllocations = allocations.filter((allocation) => allocation.payment?.vendor_id === id);
  const paidOn = new Map();
  for (const allocation of ownAllocations) {
    if (allocation.payment?.status === "active" && allocation.purchase_id) paidOn.set(allocation.purchase_id, (paidOn.get(allocation.purchase_id) ?? 0) + allocation.amount_paise);
  }
  return {
    ...withMoneyFigures(vendor, purchases, payments, allocations, today),
    products,
    purchases: purchases.map((purchase) => ({ ...purchase, pay: purchasePayState(purchase, paidOn.get(purchase.id) ?? 0, today) })),
    payments,
    advances: unallocatedPayments(payments, ownAllocations),
    statement: vendorStatement({ vendor, purchases, payments }),
    today,
  };
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

const PURCHASE_LIST_COLUMNS = "id, number, status, order_date, expected_date, bill_number, bill_date, due_date, total_paise, created_at, vendor:vendor_id(id, name), purchase_items(qty_ordered, qty_received), allocations:vendor_payment_allocations(amount_paise, payment:payment_id(status))";

export const PAY_FILTERS = ["unpaid", "overdue", "paid"];

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
const activePaid = (allocations = []) => allocations.filter((a) => a.payment?.status === "active").reduce((sum, a) => sum + a.amount_paise, 0);

// pay: "unpaid" (bill with something left to pay), "overdue" (past its pay-by date), "paid" (fully paid).
export async function booksGetPurchases({ status, vendorId, from, to, q, pay } = {}) {
  const supabase = createSupabaseServerClient();
  let query = supabase.from("purchases").select(PURCHASE_LIST_COLUMNS);
  if (PURCHASE_STATUSES.includes(status)) query = query.eq("status", status);
  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (isDate(from)) query = query.gte("order_date", from);
  if (isDate(to)) query = query.lte("order_date", to);
  const term = searchTerm(q);
  if (term) query = query.or(`number.ilike.%${term}%,bill_number.ilike.%${term}%`);
  const rows = unwrap(await query.order("order_date", { ascending: false }).order("created_at", { ascending: false }).limit(500));
  const today = todayInIndia();
  const list = rows.map((row) => ({
    ...row,
    qtyOrdered: row.purchase_items.reduce((sum, item) => sum + item.qty_ordered, 0),
    qtyReceived: row.purchase_items.reduce((sum, item) => sum + item.qty_received, 0),
    pay: purchasePayState(row, activePaid(row.allocations), today),
  }));
  if (pay === "unpaid") return list.filter((row) => row.pay.balancePaise > 0);
  if (pay === "overdue") return list.filter((row) => row.pay.overdueDays > 0);
  if (pay === "paid") return list.filter((row) => row.pay.state === "paid");
  return list;
}

// Number of purchases per status, for the list tabs.
export async function booksGetPurchaseCounts() {
  const rows = unwrap(await createSupabaseServerClient().from("purchases").select("status").limit(10000));
  return rows.reduce((counts, row) => ({ ...counts, [row.status]: (counts[row.status] ?? 0) + 1 }), {});
}

export async function booksGetPurchase(id) {
  const supabase = createSupabaseServerClient();
  const purchase = unwrap(await supabase.from("purchases")
    .select("*, vendor:vendor_id(id, name, contact_person, phone, whatsapp, address, city, state, gstin, upi_id, payment_terms_days, status), items:purchase_items(id, product_id, qty_ordered, qty_received, unit_cost_paise, tax_rate, line_total_paise, landed_unit_cost_paise, sort_order, product:product_id(name, sku, slug, stock)), allocations:vendor_payment_allocations(amount_paise, payment:payment_id(id, number, paid_on, method, reference, status, created_at))")
    .eq("id", id).maybeSingle());
  if (!purchase) return null;
  const receipts = unwrap(await supabase.from("stock_movements")
    .select("id, product_id, qty_change, unit_cost_paise, note, created_at")
    .eq("ref_type", "purchase").eq("ref_id", id).order("created_at"));
  purchase.items.sort((a, b) => a.sort_order - b.sort_order);
  const locked = purchase.status === "partially_received" || purchase.status === "received" || purchase.items.some((item) => item.qty_received > 0);
  const payments = purchase.allocations
    .map((allocation) => ({ ...allocation.payment, allocatedPaise: allocation.amount_paise }))
    .sort((a, b) => a.paid_on.localeCompare(b.paid_on) || Date.parse(a.created_at) - Date.parse(b.created_at));
  const pay = purchasePayState(purchase, payments.filter((p) => p.status === "active").reduce((sum, p) => sum + p.allocatedPaise, 0), todayInIndia());
  return { ...purchase, receipts, locked, editable: !locked && purchase.status !== "cancelled", payments, pay };
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

// ---------------------------------------------------------------- payments

export const PAYMENT_STATUSES = ["active", "voided"];

const PAYMENT_LIST_COLUMNS = `${PAYMENT_MONEY_COLUMNS}, void_reason, vendor:vendor_id(id, name), allocations:vendor_payment_allocations(purchase_id, amount_paise, purchase:purchase_id(number))`;

export async function booksGetPayments({ vendorId, from, to, method, status = "active" } = {}) {
  let query = createSupabaseServerClient().from("vendor_payments").select(PAYMENT_LIST_COLUMNS);
  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (isDate(from)) query = query.gte("paid_on", from);
  if (isDate(to)) query = query.lte("paid_on", to);
  if (["upi", "bank", "cash", "other"].includes(method)) query = query.eq("method", method);
  if (PAYMENT_STATUSES.includes(status)) query = query.eq("status", status);
  const rows = unwrap(await query.order("paid_on", { ascending: false }).order("created_at", { ascending: false }).limit(500));
  return rows.map((row) => {
    const allocatedPaise = row.allocations.reduce((sum, allocation) => sum + allocation.amount_paise, 0);
    return { ...row, allocatedPaise, advancePaise: row.amount_paise - allocatedPaise };
  });
}

// One vendor's open items (opening balance + bills). exceptPaymentId puts that payment's own allocations back,
// so its allocation can be edited.
async function vendorOpenItems(supabase, vendor, { exceptPaymentId = null } = {}) {
  const [purchases, allocations] = await Promise.all([
    supabase.from("purchases").select(PURCHASE_MONEY_COLUMNS).eq("vendor_id", vendor.id).neq("status", "cancelled").limit(1000).then(unwrap),
    allAllocations(supabase),
  ]);
  return openItems({
    openingBalancePaise: vendor.opening_balance_paise,
    purchases,
    allocations: allocations.filter((allocation) => allocation.payment?.vendor_id === vendor.id),
    today: todayInIndia(),
    exceptPaymentId,
  });
}

export async function booksGetPayment(id) {
  const supabase = createSupabaseServerClient();
  const payment = unwrap(await supabase.from("vendor_payments")
    .select("*, vendor:vendor_id(id, name, status, opening_balance_paise, upi_id, whatsapp), allocations:vendor_payment_allocations(id, purchase_id, amount_paise, purchase:purchase_id(id, number, bill_number, bill_date, order_date, total_paise, due_date))")
    .eq("id", id).maybeSingle());
  if (!payment) return null;
  const allocatedPaise = payment.allocations.reduce((sum, allocation) => sum + allocation.amount_paise, 0);
  const items = payment.status === "active" ? await vendorOpenItems(supabase, payment.vendor, { exceptPaymentId: payment.id }) : [];
  return { ...payment, allocatedPaise, advancePaise: payment.amount_paise - allocatedPaise, openItems: items };
}

// Record-payment form: active vendors, each with what's open to pay.
export async function booksGetPaymentFormData() {
  const supabase = createSupabaseServerClient();
  const [vendors, purchases, payments, allocations] = await Promise.all([
    supabase.from("vendors").select("id, name, opening_balance_paise, upi_id, status").eq("status", "active").order("name").then(unwrap),
    supabase.from("purchases").select(PURCHASE_MONEY_COLUMNS).neq("status", "cancelled").limit(5000).then(unwrap),
    supabase.from("vendor_payments").select(PAYMENT_MONEY_COLUMNS).eq("status", "active").limit(5000).then(unwrap),
    allAllocations(supabase),
  ]);
  const today = todayInIndia();
  return vendors.map((vendor) => {
    const figures = withMoneyFigures(vendor, purchases, payments, allocations, today);
    return { id: vendor.id, name: vendor.name, upiId: vendor.upi_id, balancePaise: figures.balancePaise, items: figures.openItems };
  });
}

function addDaysIso(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Payables: every open bill across vendors (archived ones too: money is still owed), and advances.
export async function booksGetPayables() {
  const supabase = createSupabaseServerClient();
  const [vendors, purchases, payments, allocations] = await Promise.all([
    supabase.from("vendors").select(VENDOR_LIST_COLUMNS).order("name").then(unwrap),
    supabase.from("purchases").select(PURCHASE_MONEY_COLUMNS).neq("status", "cancelled").limit(5000).then(unwrap),
    supabase.from("vendor_payments").select(PAYMENT_MONEY_COLUMNS).eq("status", "active").limit(5000).then(unwrap),
    allAllocations(supabase),
  ]);
  const today = todayInIndia();
  const weekAhead = addDaysIso(today, 7);
  const figures = vendors.map((vendor) => withMoneyFigures(vendor, purchases, payments, allocations, today));
  const bills = figures.flatMap((vendor) => vendor.openItems.map((item) => ({ ...item, vendor: { id: vendor.id, name: vendor.name } })))
    .sort((a, b) => b.overdueDays - a.overdueDays || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || (a.date ?? "").localeCompare(b.date ?? ""));
  const overdue = bills.filter((bill) => bill.overdueDays > 0);
  const names = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  return {
    today,
    bills,
    owing: figures.filter((vendor) => vendor.balancePaise > 0).sort((a, b) => b.balancePaise - a.balancePaise),
    unallocated: unallocatedPayments(payments, allocations).map((row) => ({ ...row, vendorName: names.get(row.payment.vendor_id) ?? "" })),
    totalDuePaise: figures.reduce((sum, vendor) => sum + Math.max(vendor.balancePaise, 0), 0),
    advancePaise: figures.reduce((sum, vendor) => sum + Math.max(-vendor.balancePaise, 0), 0),
    overduePaise: overdue.reduce((sum, bill) => sum + bill.balancePaise, 0),
    overdueCount: overdue.length,
    dueSoon: bills.filter((bill) => bill.overdueDays === 0 && bill.dueDate && bill.dueDate >= today && bill.dueDate <= weekAhead),
  };
}
