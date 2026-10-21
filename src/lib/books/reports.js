// Books reports: P&L, product margin, payables ageing, stock valuation, cash flow, statement by date range.
// Pure functions over rows already read from the database, so every number is unit-tested.
// Relative imports on purpose so `node --test` can load this file directly.
import { addMonths } from "./expenses.js";
import { daysBetween } from "./payments.js";
import { weightedAverageCost } from "./purchases.js";

// Orders that count as sales: money kept (not cancelled or refunded). Same as SALE_STATUSES in admin-catalog.
export const SALE_STATUSES = ["paid", "shipped", "delivered"];

const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
// Calendar day / month in India for a timestamp.
export const istDay = (ts) => istDate.format(new Date(ts));
export const istMonth = (ts) => istDay(ts).slice(0, 7);

// Timestamp bounds for IST calendar dates: [start of `from`, start of the day after `to`).
export function istBounds(from, to) {
  const next = new Date(`${to}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { fromTs: `${from}T00:00:00+05:30`, toTs: `${next.toISOString().slice(0, 10)}T00:00:00+05:30` };
}

// "2026-08".."2026-10" → ["2026-08", "2026-09", "2026-10"] (at most `max`, newest kept).
export function monthsBetween(fromMonth, toMonth, { max = 24 } = {}) {
  const months = [];
  for (let month = fromMonth; month <= toMonth && months.length < 1000; month = addMonths(`${month}-01`, 1).slice(0, 7)) months.push(month);
  return months.slice(-max);
}

// "2026-02" → "2026-02-28".
export function monthEnd(month) {
  const next = new Date(`${addMonths(`${month}-01`, 1)}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() - 1);
  return next.toISOString().slice(0, 10);
}

const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

// Change from `before` to `now` in % (null when there's nothing to compare with).
export const pctChange = (now, before) => (before ? Math.round(((now - before) / Math.abs(before)) * 1000) / 10 : null);

// ---------------------------------------------------------------- profit & loss

// orders: sale orders [{ paid_at, subtotal_paise, shipping_paise, order_items: [{ quantity, unit_cost_paise }] }]
// expenses: active expenses [{ spent_on, amount_paise, category: { name } }]
// Returns { columns: [{ month, ...figures }], total: figures, categories: [names] }.
// Sales = item value (subtotal); delivery = what customers paid for delivery; COGS = cost snapshot × qty.
export function profitAndLoss({ orders = [], expenses = [], months }) {
  const blank = (month) => ({ month, salesPaise: 0, deliveryPaise: 0, revenuePaise: 0, cogsPaise: 0, uncostedUnits: 0, orders: 0, grossPaise: 0, expenses: {}, expensesPaise: 0, netPaise: 0 });
  const byMonth = new Map(months.map((month) => [month, blank(month)]));
  const categories = new Set();
  for (const order of orders) {
    const column = byMonth.get(istMonth(order.paid_at));
    if (!column) continue;
    column.orders += 1;
    column.salesPaise += order.subtotal_paise;
    column.deliveryPaise += order.shipping_paise;
    for (const item of order.order_items ?? []) {
      if (item.unit_cost_paise == null) column.uncostedUnits += item.quantity;
      else column.cogsPaise += item.unit_cost_paise * item.quantity;
    }
  }
  for (const expense of expenses) {
    const column = byMonth.get(String(expense.spent_on).slice(0, 7));
    if (!column) continue;
    const name = expense.category?.name ?? "Uncategorised";
    categories.add(name);
    column.expenses[name] = (column.expenses[name] ?? 0) + expense.amount_paise;
    column.expensesPaise += expense.amount_paise;
  }
  const total = blank("total");
  for (const column of byMonth.values()) {
    column.revenuePaise = column.salesPaise + column.deliveryPaise;
    column.grossPaise = column.revenuePaise - column.cogsPaise;
    column.netPaise = column.grossPaise - column.expensesPaise;
    column.grossMarginPct = pct(column.grossPaise, column.revenuePaise);
    for (const key of ["salesPaise", "deliveryPaise", "revenuePaise", "cogsPaise", "uncostedUnits", "orders", "grossPaise", "expensesPaise", "netPaise"]) total[key] += column[key];
    for (const [name, paise] of Object.entries(column.expenses)) total.expenses[name] = (total.expenses[name] ?? 0) + paise;
  }
  total.grossMarginPct = pct(total.grossPaise, total.revenuePaise);
  const sortedCategories = [...categories].sort((a, b) => (total.expenses[b] ?? 0) - (total.expenses[a] ?? 0) || a.localeCompare(b));
  return { columns: [...byMonth.values()], total, categories: sortedCategories };
}

// ---------------------------------------------------------------- product margin

// items: order lines of sale orders [{ product_id, product_name, category, quantity, unit_price_paise, unit_cost_paise }]
// Returns { products: [...], categories: [...] } — each { key, name, units, revenuePaise, cogsPaise, uncostedUnits,
// grossPaise, marginPct }, biggest revenue first. Margin is only over lines whose cost is known.
export function productMargins(items = []) {
  const add = (map, key, name, item) => {
    const row = map.get(key) ?? { key, name, units: 0, revenuePaise: 0, cogsPaise: 0, uncostedUnits: 0, costedRevenuePaise: 0 };
    const revenue = item.unit_price_paise * item.quantity;
    row.units += item.quantity;
    row.revenuePaise += revenue;
    if (item.unit_cost_paise == null) row.uncostedUnits += item.quantity;
    else { row.cogsPaise += item.unit_cost_paise * item.quantity; row.costedRevenuePaise += revenue; }
    map.set(key, row);
  };
  const products = new Map();
  const categories = new Map();
  for (const item of items) {
    add(products, item.product_id ?? `name:${item.product_name}`, item.product_name, item);
    add(categories, item.category ?? "Uncategorised", item.category ?? "Uncategorised", item);
  }
  const finish = (rows) => [...rows.values()].map((row) => {
    const grossPaise = row.costedRevenuePaise - row.cogsPaise;
    return { ...row, grossPaise, marginPct: pct(grossPaise, row.costedRevenuePaise) };
  }).sort((a, b) => b.revenuePaise - a.revenuePaise || a.name.localeCompare(b.name));
  return { products: finish(products), categories: finish(categories) };
}

// ---------------------------------------------------------------- payables ageing

export const AGEING_BUCKETS = [["0–30 days", 0, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["90+ days", 91, Infinity]];

// items: open items with { vendor: { id, name }, date (bill/order date; null = opening balance), balancePaise }.
// openingDates: Map(vendorId → date the opening balance dates from). Age = days since the bill date.
export function payablesAgeing(items, today, openingDates = new Map()) {
  const vendors = new Map();
  for (const item of items) {
    if (item.balancePaise <= 0) continue;
    const from = item.date ?? openingDates.get(item.vendor.id) ?? today;
    const age = Math.max(daysBetween(from, today), 0);
    const bucket = AGEING_BUCKETS.findIndex(([, min, max]) => age >= min && age <= max);
    const row = vendors.get(item.vendor.id) ?? { vendor: item.vendor, buckets: AGEING_BUCKETS.map(() => 0), totalPaise: 0 };
    row.buckets[bucket] += item.balancePaise;
    row.totalPaise += item.balancePaise;
    vendors.set(item.vendor.id, row);
  }
  const rows = [...vendors.values()].sort((a, b) => b.totalPaise - a.totalPaise || a.vendor.name.localeCompare(b.vendor.name));
  const totals = AGEING_BUCKETS.map((_, index) => rows.reduce((sum, row) => sum + row.buckets[index], 0));
  return { rows, totals, totalPaise: totals.reduce((a, b) => a + b, 0) };
}

// ---------------------------------------------------------------- stock valuation

// Stock and cost of each product at the end of `asOf` (IST), replayed from the stock ledger.
// Quantity: the last movement's stock_after.
// Cost: with costChanges (every change of products.cost_price_paise from the audit log: [{ product_id, cost_paise,
// created_at }]) the last change by that time — exact, including costs set by hand. Without them, an estimate from
// the ledger: receipts apply the same weighted average as SQL, other movements carry the cost at that moment.
// products: [{ id, name, sku, price_paise, category }].
export function stockValuation(products, movements, asOf, costChanges = null) {
  const end = istBounds(asOf, asOf).toTs;
  const state = new Map();
  if (costChanges) {
    const costs = new Map();
    for (const change of [...costChanges].filter((c) => new Date(c.created_at) < new Date(end)).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
      costs.set(change.product_id, change.cost_paise);
    }
    for (const move of movements.filter((m) => new Date(m.created_at) < new Date(end)).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
      state.set(move.product_id, { qty: move.stock_after, cost: costs.get(move.product_id) ?? null });
    }
    for (const [productId, cost] of costs) if (state.has(productId)) state.get(productId).cost = cost;
    return finishValuation(products, state);
  }
  const sorted = movements.filter((move) => new Date(move.created_at) < new Date(end))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const move of sorted) {
    const current = state.get(move.product_id) ?? { qty: 0, cost: null };
    const before = move.stock_after - move.qty_change;
    if (move.reason === "purchase_receipt" && move.unit_cost_paise != null) current.cost = weightedAverageCost(before, current.cost, move.qty_change, move.unit_cost_paise);
    else if (move.unit_cost_paise != null) current.cost = move.unit_cost_paise;
    current.qty = move.stock_after;
    state.set(move.product_id, current);
  }
  return finishValuation(products, state);
}

function finishValuation(products, state) {
  const rows = products.map((product) => {
    const { qty, cost } = state.get(product.id) ?? { qty: 0, cost: null };
    return { ...product, qty, costPaise: cost, valuePaise: cost != null ? cost * qty : null, valueAtPricePaise: product.price_paise * qty };
  }).filter((row) => row.qty !== 0).sort((a, b) => (b.valuePaise ?? -1) - (a.valuePaise ?? -1) || a.name.localeCompare(b.name));
  return {
    rows,
    units: rows.reduce((sum, row) => sum + row.qty, 0),
    valuePaise: rows.reduce((sum, row) => sum + (row.valuePaise ?? 0), 0),
    valueAtPricePaise: rows.reduce((sum, row) => sum + row.valueAtPricePaise, 0),
    uncosted: rows.filter((row) => row.costPaise == null).length,
  };
}

// ---------------------------------------------------------------- cash flow

// Money in: paid orders (by paid date) minus refunds (by refund date). Money out: active vendor payments + active
// expenses. orders: [{ paid_at, total_paise, refund_amount_paise, refunded_at }].
export function cashFlow({ orders = [], payments = [], expenses = [], months }) {
  const byMonth = new Map(months.map((month) => [month, { month, inPaise: 0, refundsPaise: 0, vendorsPaise: 0, expensesPaise: 0 }]));
  for (const order of orders) {
    const paid = order.paid_at && byMonth.get(istMonth(order.paid_at));
    if (paid) paid.inPaise += order.total_paise;
    const refunded = order.refunded_at && order.refund_amount_paise && byMonth.get(istMonth(order.refunded_at));
    if (refunded) refunded.refundsPaise += order.refund_amount_paise;
  }
  for (const payment of payments) {
    const row = byMonth.get(String(payment.paid_on).slice(0, 7));
    if (row) row.vendorsPaise += payment.amount_paise;
  }
  for (const expense of expenses) {
    const row = byMonth.get(String(expense.spent_on).slice(0, 7));
    if (row) row.expensesPaise += expense.amount_paise;
  }
  return [...byMonth.values()].map((row) => {
    const moneyIn = row.inPaise - row.refundsPaise;
    const moneyOut = row.vendorsPaise + row.expensesPaise;
    return { ...row, moneyInPaise: moneyIn, moneyOutPaise: moneyOut, netPaise: moneyIn - moneyOut };
  });
}

// ---------------------------------------------------------------- vendor statement for a date range

// statement: vendorStatement() result (all lines, date order, running balance). Lines before `from` roll into the
// opening balance; lines after `to` are left out.
export function statementForRange(statement, from, to) {
  let opening = statement.openingPaise;
  const lines = [];
  for (const line of statement.lines) {
    if (from && line.date < from) { if (!line.voided) opening = line.balancePaise; continue; }
    if (to && line.date > to) continue;
    lines.push(line);
  }
  let balance = opening;
  const rebased = lines.map((line) => {
    if (!line.voided) balance += line.debitPaise - line.creditPaise;
    return { ...line, balancePaise: balance };
  });
  const active = rebased.filter((line) => !line.voided);
  return {
    openingPaise: opening,
    lines: rebased,
    billedPaise: active.reduce((sum, line) => sum + line.debitPaise, 0),
    paidPaise: active.reduce((sum, line) => sum + line.creditPaise, 0),
    closingPaise: balance,
  };
}
