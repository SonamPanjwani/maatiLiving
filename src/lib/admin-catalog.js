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

const ORDER_LIST_COLUMNS = "id, order_number, status, payment_method, payment_reference, customer_name, email, phone, city, state, total_paise, created_at, paid_at, order_items(quantity)";
export const SALE_STATUSES = ["paid", "shipped", "delivered"]; // money kept (not cancelled/refunded)

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));

// Shared filters for the orders list and CSV export. Dates are IST calendar days.
function applyOrderFilters(query, { statuses, paymentMethod, q, from, to }) {
  if (statuses?.length) query = query.in("status", statuses);
  if (paymentMethod) query = query.eq("payment_method", paymentMethod);
  if (isDate(from)) query = query.gte("created_at", `${from}T00:00:00+05:30`);
  if (isDate(to)) query = query.lte("created_at", `${to}T23:59:59.999+05:30`);
  // Strip characters that have meaning in PostgREST filter syntax before building the OR search.
  const term = String(q ?? "").replace(/[%,()*\\:"']/g, " ").trim().slice(0, 60);
  if (term) query = query.or(["order_number", "customer_name", "email", "phone"].map((column) => `${column}.ilike.%${term}%`).join(","));
  return query;
}

export async function adminGetOrders(filters) {
  return unwrap(await applyOrderFilters(createSupabaseServerClient().from("orders").select(ORDER_LIST_COLUMNS), filters)
    .order("created_at", { ascending: false }).limit(300));
}

export async function adminExportOrders(filters) {
  return unwrap(await applyOrderFilters(createSupabaseServerClient().from("orders").select("*, order_items(product_name, quantity, unit_price_paise)"), filters)
    .order("created_at", { ascending: false }).limit(5000));
}

export async function adminGetOrder(id) {
  return unwrap(await createSupabaseServerClient().from("orders").select("*, order_items(*)").eq("id", id).maybeSingle());
}

// Everyone who has paid for an order, guests included, grouped by email.
export async function adminGetCustomers({ q } = {}) {
  const orders = unwrap(await createSupabaseServerClient().from("orders")
    .select("email, customer_name, phone, city, state, total_paise, status, user_id, created_at")
    .in("status", [...SALE_STATUSES, "refunded", "cancelled"])
    .order("created_at", { ascending: false }).limit(5000));

  const byEmail = new Map();
  for (const order of orders) {
    const key = order.email.toLowerCase();
    const customer = byEmail.get(key) ?? {
      email: key, name: order.customer_name, phone: order.phone, city: order.city, state: order.state,
      orders: 0, spentPaise: 0, lastOrderAt: order.created_at, hasAccount: false,
    };
    if (SALE_STATUSES.includes(order.status)) {
      customer.orders += 1;
      customer.spentPaise += order.total_paise;
    }
    customer.hasAccount ||= Boolean(order.user_id);
    byEmail.set(key, customer);
  }

  const term = String(q ?? "").toLowerCase().trim();
  return [...byEmail.values()]
    .filter((customer) => customer.orders > 0)
    .filter((customer) => !term || [customer.email, customer.name, customer.phone, customer.city].some((value) => value?.toLowerCase().includes(term)))
    .sort((a, b) => b.spentPaise - a.spentPaise);
}

// IST calendar day (YYYY-MM-DD) for a timestamp.
const istDay = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(date));

export async function adminGetDashboard({ lowStockAt = 5 } = {}) {
  const supabase = createSupabaseServerClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [orders, toShip, upiToVerify, lowStock, recent] = await Promise.all([
    supabase.from("orders").select("total_paise, paid_at, order_items(product_name, product_slug, quantity, unit_price_paise)")
      .in("status", SALE_STATUSES).gte("paid_at", since).then(unwrap),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid").then(({ count }) => count ?? 0),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending").eq("payment_method", "upi_manual").not("payment_reference", "is", null).then(({ count }) => count ?? 0),
    supabase.from("products").select("id, name, stock, is_available").lte("stock", lowStockAt).order("stock").limit(12).then(unwrap),
    supabase.from("orders").select("id, order_number, status, payment_method, payment_reference, customer_name, total_paise, created_at")
      .in("status", [...SALE_STATUSES, "cancelled", "refunded"]).order("created_at", { ascending: false }).limit(8).then(unwrap),
  ]);

  // Last 30 IST days, oldest first, zero-filled.
  const days = [];
  for (let i = 29; i >= 0; i -= 1) days.push({ day: istDay(Date.now() - i * 24 * 60 * 60 * 1000), revenuePaise: 0, orders: 0 });
  const dayIndex = new Map(days.map((entry, index) => [entry.day, index]));
  const products = new Map();
  for (const order of orders) {
    const index = dayIndex.get(istDay(order.paid_at));
    if (index != null) {
      days[index].revenuePaise += order.total_paise;
      days[index].orders += 1;
    }
    for (const item of order.order_items) {
      const entry = products.get(item.product_name) ?? { name: item.product_name, slug: item.product_slug, quantity: 0, revenuePaise: 0 };
      entry.quantity += item.quantity;
      entry.revenuePaise += item.quantity * item.unit_price_paise;
      products.set(item.product_name, entry);
    }
  }

  const sum = (from) => days.slice(from).reduce((total, entry) => ({ revenuePaise: total.revenuePaise + entry.revenuePaise, orders: total.orders + entry.orders }), { revenuePaise: 0, orders: 0 });
  return {
    today: sum(29),
    week: sum(23),
    month: sum(0),
    days,
    toShip,
    upiToVerify,
    lowStock,
    recent,
    bestSellers: [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
  };
}
