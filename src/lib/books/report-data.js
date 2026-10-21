import "server-only";
import { booksGetPayables, booksGetVendor } from "@/src/lib/books/data";
import { cashFlow, istBounds, monthEnd, monthsBetween, payablesAgeing, productMargins, profitAndLoss, SALE_STATUSES, statementForRange, stockValuation } from "@/src/lib/books/reports";
import { addMonths } from "@/src/lib/books/expenses";
import { todayInIndia } from "@/src/lib/format";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Reads for Books reports, dashboard figures and the CA export. Admin session client, so RLS applies.
// Every list is read in pages of 1000 (Supabase's row cap), so totals never silently miss rows.

const PAGE = 1000;

export async function fetchAll(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

const ORDER_MONEY = "id, order_number, status, payment_method, paid_at, subtotal_paise, shipping_paise, total_paise, refund_amount_paise, refunded_at";

// Sale orders (money kept) paid between two IST dates, with their lines (cost snapshot + product category).
function saleOrders(supabase, from, to, { lines = true } = {}) {
  const { fromTs, toTs } = istBounds(from, to);
  const columns = lines
    ? `${ORDER_MONEY}, order_items(product_id, product_name, quantity, unit_price_paise, unit_cost_paise, product:product_id(sku, category:category_id(name)))`
    : ORDER_MONEY;
  return fetchAll(() => supabase.from("orders").select(columns).in("status", SALE_STATUSES).gte("paid_at", fromTs).lt("paid_at", toTs).order("paid_at"));
}

const activeExpenses = (supabase, from, to) => fetchAll(() => supabase.from("expenses")
  .select("id, number, spent_on, amount_paise, tax_paise, paid_via, description, vendor:vendor_id(name), category:category_id(name)")
  .eq("status", "active").gte("spent_on", from).lte("spent_on", to).order("spent_on"));

// ---------------------------------------------------------------- reports

export async function reportProfitAndLoss(fromMonth, toMonth) {
  const supabase = createSupabaseServerClient();
  const months = monthsBetween(fromMonth, toMonth);
  const from = `${months[0]}-01`;
  const to = monthEnd(months.at(-1));
  const [orders, expenses] = await Promise.all([saleOrders(supabase, from, to), activeExpenses(supabase, from, to)]);
  return profitAndLoss({ orders, expenses, months });
}

export async function reportProductMargins(from, to) {
  const orders = await saleOrders(createSupabaseServerClient(), from, to);
  return productMargins(orders.flatMap((order) => order.order_items.map((item) => ({ ...item, category: item.product?.category?.name ?? null }))));
}

export async function reportPayablesAgeing() {
  const supabase = createSupabaseServerClient();
  const [payables, vendors] = await Promise.all([booksGetPayables(), supabase.from("vendors").select("id, created_at").then(({ data }) => data ?? [])]);
  const openingDates = new Map(vendors.map((vendor) => [vendor.id, todayInIndia(new Date(vendor.created_at))]));
  return { today: payables.today, ...payablesAgeing(payables.bills, payables.today, openingDates) };
}

export async function reportStockValuation(asOf) {
  const supabase = createSupabaseServerClient();
  const { toTs } = istBounds(asOf, asOf);
  const [products, movements, audit] = await Promise.all([
    supabase.from("products").select("id, name, sku, price_paise, category:category_id(name)").order("name").then(({ data, error }) => { if (error) throw new Error(error.message); return data; }),
    fetchAll(() => supabase.from("stock_movements").select("id, product_id, reason, qty_change, stock_after, unit_cost_paise, created_at").lt("created_at", toTs).order("created_at")),
    // Every recorded change to a product's cost price (receipts and costs set by hand), from the audit log.
    fetchAll(() => supabase.from("audit_log").select("id, entity_id, before_cost:before->cost_price_paise, after_cost:after->cost_price_paise, created_at")
      .eq("entity", "products").eq("action", "update").lt("created_at", toTs).order("id")),
  ]);
  const costChanges = audit.filter((row) => row.before_cost !== row.after_cost)
    .map((row) => ({ product_id: row.entity_id, cost_paise: row.after_cost == null ? null : Number(row.after_cost), created_at: row.created_at }));
  return stockValuation(products.map((p) => ({ ...p, category: p.category?.name ?? null })), movements, asOf, costChanges);
}

export async function reportStockMovements(from, to, { productId } = {}) {
  const supabase = createSupabaseServerClient();
  const { fromTs, toTs } = istBounds(from, to);
  return fetchAll(() => {
    let query = supabase.from("stock_movements")
      .select("id, created_at, qty_change, stock_after, reason, adjustment_reason, ref_type, ref_id, unit_cost_paise, note, product:product_id(id, name, sku)")
      .gte("created_at", fromTs).lt("created_at", toTs);
    if (productId) query = query.eq("product_id", productId);
    return query.order("created_at");
  });
}

export async function reportExpenses(from, to) {
  const expenses = await activeExpenses(createSupabaseServerClient(), from, to);
  const totals = new Map();
  for (const expense of expenses) {
    const name = expense.category?.name ?? "Uncategorised";
    const row = totals.get(name) ?? { name, count: 0, totalPaise: 0, taxPaise: 0 };
    row.count += 1;
    row.totalPaise += expense.amount_paise;
    row.taxPaise += expense.tax_paise;
    totals.set(name, row);
  }
  const categories = [...totals.values()].sort((a, b) => b.totalPaise - a.totalPaise || a.name.localeCompare(b.name));
  return { expenses, categories, totalPaise: categories.reduce((sum, row) => sum + row.totalPaise, 0), taxPaise: categories.reduce((sum, row) => sum + row.taxPaise, 0) };
}

export async function reportVendorStatement(vendorId, from, to) {
  const vendor = await booksGetVendor(vendorId);
  if (!vendor) return null;
  return { vendor, ...statementForRange(vendor.statement, from, to) };
}

// ---------------------------------------------------------------- dashboard

// This month vs last month P&L, payables summary, and 6-month cash flow. Each part is optional: if a Books
// migration isn't run yet, that part comes back null and the dashboard still loads.
export async function booksGetDashboardFigures() {
  const supabase = createSupabaseServerClient();
  const today = todayInIndia();
  const month = today.slice(0, 7);
  const lastMonth = addMonths(`${month}-01`, -1).slice(0, 7);
  const months = monthsBetween(addMonths(`${month}-01`, -5).slice(0, 7), month);
  const from = `${months[0]}-01`;
  const safe = (promise) => promise.catch(() => null);

  const [pl, payables, flow] = await Promise.all([
    safe(reportProfitAndLoss(lastMonth, month)),
    safe(booksGetPayables()),
    safe((async () => {
      const { fromTs, toTs } = istBounds(from, today);
      const [orders, refunds, payments, expenses] = await Promise.all([
        fetchAll(() => supabase.from("orders").select("paid_at, total_paise").not("paid_at", "is", null).gte("paid_at", fromTs).lt("paid_at", toTs)),
        fetchAll(() => supabase.from("orders").select("refunded_at, refund_amount_paise").not("refunded_at", "is", null).gte("refunded_at", fromTs).lt("refunded_at", toTs)),
        fetchAll(() => supabase.from("vendor_payments").select("paid_on, amount_paise").eq("status", "active").gte("paid_on", from)),
        fetchAll(() => supabase.from("expenses").select("spent_on, amount_paise").eq("status", "active").gte("spent_on", from)),
      ]);
      return cashFlow({ orders: [...orders, ...refunds], payments, expenses, months });
    })()),
  ]);

  return {
    month,
    thisMonth: pl?.columns.at(-1) ?? null,
    lastMonth: pl?.columns.at(-2) ?? null,
    payables: payables && {
      totalDuePaise: payables.totalDuePaise,
      overdueCount: payables.overdueCount,
      overduePaise: payables.overduePaise,
      next: payables.bills.filter((bill) => bill.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3),
    },
    cashFlow: flow,
  };
}

// ---------------------------------------------------------------- CA export (one month)

export async function caExportData(month) {
  const supabase = createSupabaseServerClient();
  const from = `${month}-01`;
  const to = monthEnd(month);
  const { fromTs, toTs } = istBounds(from, to);
  const [orders, purchases, payments, expenses, valuation] = await Promise.all([
    // Every order paid in the month, whatever happened later, so refunds and cancellations are visible.
    fetchAll(() => supabase.from("orders")
      .select(`${ORDER_MONEY}, created_at, customer_name, state, payment_reference, razorpay_payment_id, order_items(product_name, quantity, unit_price_paise, unit_cost_paise)`)
      .not("paid_at", "is", null).gte("paid_at", fromTs).lt("paid_at", toTs).order("paid_at")),
    // Purchases billed / ordered in the month.
    fetchAll(() => supabase.from("purchases")
      .select("id, number, status, order_date, bill_number, bill_date, due_date, subtotal_paise, discount_paise, shipping_paise, tax_paise, total_paise, received_at, cancelled_reason, vendor:vendor_id(name, gstin, state), purchase_items(qty_ordered, qty_received, unit_cost_paise, tax_rate, line_total_paise, landed_unit_cost_paise, product:product_id(name, sku))")
      .or(`and(bill_date.gte.${from},bill_date.lte.${to}),and(bill_date.is.null,order_date.gte.${from},order_date.lte.${to})`).order("order_date")),
    fetchAll(() => supabase.from("vendor_payments")
      .select("id, number, paid_on, amount_paise, method, reference, status, void_reason, vendor:vendor_id(name, gstin), allocations:vendor_payment_allocations(amount_paise, purchase:purchase_id(number, bill_number))")
      .gte("paid_on", from).lte("paid_on", to).order("paid_on")),
    fetchAll(() => supabase.from("expenses")
      .select("id, number, spent_on, amount_paise, tax_paise, paid_via, description, status, void_reason, vendor:vendor_id(name, gstin), category:category_id(name)")
      .gte("spent_on", from).lte("spent_on", to).order("spent_on")),
    reportStockValuation(to),
  ]);
  return { month, from, to, orders, purchases, payments, expenses, valuation };
}
