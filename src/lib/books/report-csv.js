// CSV layouts for Books reports and the CA export pack. Pure (no server imports) so the column names stay
// stable and testable. CA pack columns are snake_case on purpose: they're meant for later Zoho / Tally imports.
// Relative imports on purpose so `node --test` can load this file directly.
import { csvRupees as r, toCsv } from "../csv.js";
import { PAYMENT_METHODS } from "./payments.js";
import { PAID_VIA } from "./expenses.js";
import { AGEING_BUCKETS, istDay } from "./reports.js";

const ist = (ts) => (ts ? istDay(ts) : "");
const MOVEMENT = { opening_stock: "Opening stock", purchase_receipt: "Purchase received", order_paid: "Order paid", order_cancel_restock: "Order cancelled, restocked", manual_adjustment: "Adjustment" };

// ---------------------------------------------------------------- on-screen reports

// P&L as rows (lines) × columns (months + total).
export function pnlCsv(pl) {
  const cols = [...pl.columns, pl.total];
  const line = (label, get) => ({ label, values: cols.map(get) });
  const rows = [
    line("Orders", (c) => c.orders),
    line("Sales (items)", (c) => r(c.salesPaise)),
    line("Delivery charges collected", (c) => r(c.deliveryPaise)),
    line("Revenue", (c) => r(c.revenuePaise)),
    line("Cost of goods sold", (c) => r(c.cogsPaise)),
    line("Gross profit", (c) => r(c.grossPaise)),
    line("Gross margin %", (c) => c.grossMarginPct ?? ""),
    ...pl.categories.map((name) => line(`Expense: ${name}`, (c) => r(c.expenses[name] ?? 0))),
    line("Total expenses", (c) => r(c.expensesPaise)),
    line("Net profit", (c) => r(c.netPaise)),
    line("Units sold without a cost price", (c) => c.uncostedUnits),
  ];
  return toCsv([["Line", (row) => row.label], ...cols.map((c, i) => [c.month === "total" ? "Total" : c.month, (row) => row.values[i]])], rows);
}

export const marginCsv = (rows) => toCsv([
  ["Name", (x) => x.name], ["Units sold", (x) => x.units], ["Revenue (₹)", (x) => r(x.revenuePaise)], ["COGS (₹)", (x) => r(x.cogsPaise)],
  ["Gross profit (₹)", (x) => r(x.grossPaise)], ["Gross margin %", (x) => x.marginPct ?? ""], ["Units without cost", (x) => x.uncostedUnits],
], rows);

export const statementCsv = (statement) => toCsv([
  ["Date", (x) => x.date], ["Type", (x) => (x.kind === "opening" ? "Opening balance" : x.kind === "bill" ? "Bill" : "Payment")], ["Number", (x) => x.label ?? ""],
  ["Detail", (x) => x.detail ?? ""], ["Bill (₹)", (x) => (x.debitPaise ? r(x.debitPaise) : "")], ["Paid (₹)", (x) => (x.creditPaise ? r(x.creditPaise) : "")],
  ["Balance (₹)", (x) => r(x.balancePaise)], ["Voided", (x) => (x.voided ? "yes" : "")],
], [{ kind: "opening", date: "", balancePaise: statement.openingPaise }, ...statement.lines]);

export const ageingCsv = (ageing) => toCsv([
  ["Vendor", (x) => x.vendor.name], ...AGEING_BUCKETS.map(([label], i) => [`${label} (₹)`, (x) => r(x.buckets[i])]), ["Total (₹)", (x) => r(x.totalPaise)],
], ageing.rows);

export const valuationCsv = (valuation) => toCsv([
  ["Product", (x) => x.name], ["SKU", (x) => x.sku], ["Category", (x) => x.category], ["Qty", (x) => x.qty],
  ["Cost per piece (₹)", (x) => r(x.costPaise)], ["Value at cost (₹)", (x) => r(x.valuePaise)], ["Price (₹)", (x) => r(x.price_paise)], ["Value at price (₹)", (x) => r(x.valueAtPricePaise)],
], valuation.rows);

export const movementsCsv = (rows) => toCsv([
  ["Date (IST)", (x) => ist(x.created_at)], ["Product", (x) => x.product?.name], ["SKU", (x) => x.product?.sku], ["What", (x) => MOVEMENT[x.reason] ?? x.reason],
  ["Adjustment reason", (x) => x.adjustment_reason], ["Change", (x) => x.qty_change], ["Stock after", (x) => x.stock_after],
  ["Unit cost (₹)", (x) => r(x.unit_cost_paise)], ["Reference", (x) => (x.ref_type ? `${x.ref_type} ${x.ref_id ?? ""}`.trim() : "")], ["Note", (x) => x.note],
], rows);

export const expensesCsv = (rows) => toCsv([
  ["Number", (x) => x.number], ["Date", (x) => x.spent_on], ["Category", (x) => x.category?.name], ["What for", (x) => x.description],
  ["Vendor", (x) => x.vendor?.name], ["Paid via", (x) => PAID_VIA[x.paid_via] ?? x.paid_via], ["Amount (₹)", (x) => r(x.amount_paise)], ["GST (₹)", (x) => r(x.tax_paise)],
], rows);

// ---------------------------------------------------------------- CA export pack (one month)

const cogs = (order) => order.order_items.reduce((sum, item) => sum + (item.unit_cost_paise ?? 0) * item.quantity, 0);

export function caPackFiles(data) {
  const purchaseItems = data.purchases.flatMap((p) => p.purchase_items.map((item) => ({ ...item, purchase: p })));
  return {
    "sales.csv": toCsv([
      ["order_number", (o) => o.order_number], ["paid_date", (o) => ist(o.paid_at)], ["status", (o) => o.status], ["payment_method", (o) => o.payment_method],
      ["payment_ref", (o) => o.razorpay_payment_id || o.payment_reference], ["customer", (o) => o.customer_name], ["state", (o) => o.state],
      ["items_value", (o) => r(o.subtotal_paise)], ["delivery", (o) => r(o.shipping_paise)], ["total", (o) => r(o.total_paise)],
      ["refunded", (o) => r(o.refund_amount_paise)], ["refund_date", (o) => ist(o.refunded_at)], ["cogs", (o) => r(cogs(o))],
      ["items", (o) => o.order_items.map((i) => `${i.product_name} x ${i.quantity}`).join("; ")],
    ], data.orders),
    "purchases.csv": toCsv([
      ["po_number", (p) => p.number], ["vendor", (p) => p.vendor?.name], ["vendor_gstin", (p) => p.vendor?.gstin], ["vendor_state", (p) => p.vendor?.state],
      ["status", (p) => p.status], ["order_date", (p) => p.order_date], ["bill_number", (p) => p.bill_number], ["bill_date", (p) => p.bill_date], ["due_date", (p) => p.due_date],
      ["subtotal", (p) => r(p.subtotal_paise)], ["discount", (p) => r(p.discount_paise)], ["shipping", (p) => r(p.shipping_paise)], ["tax", (p) => r(p.tax_paise)],
      ["total", (p) => r(p.total_paise)], ["received_date", (p) => ist(p.received_at)], ["cancelled_reason", (p) => p.cancelled_reason],
    ], data.purchases),
    "purchase_items.csv": toCsv([
      ["po_number", (i) => i.purchase.number], ["bill_number", (i) => i.purchase.bill_number], ["product", (i) => i.product?.name], ["sku", (i) => i.product?.sku],
      ["qty_ordered", (i) => i.qty_ordered], ["qty_received", (i) => i.qty_received], ["unit_cost", (i) => r(i.unit_cost_paise)], ["tax_rate", (i) => i.tax_rate ?? ""],
      ["line_total", (i) => r(i.line_total_paise)], ["landed_unit_cost", (i) => r(i.landed_unit_cost_paise)],
    ], purchaseItems),
    "vendor_payments.csv": toCsv([
      ["payment_number", (p) => p.number], ["paid_on", (p) => p.paid_on], ["vendor", (p) => p.vendor?.name], ["vendor_gstin", (p) => p.vendor?.gstin],
      ["amount", (p) => r(p.amount_paise)], ["method", (p) => PAYMENT_METHODS[p.method] ?? p.method], ["reference", (p) => p.reference], ["status", (p) => p.status],
      ["void_reason", (p) => p.void_reason], ["allocated_to", (p) => p.allocations.map((a) => `${a.purchase?.number ?? "opening balance"}${a.purchase?.bill_number ? ` (${a.purchase.bill_number})` : ""}: ${r(a.amount_paise)}`).join("; ")],
    ], data.payments),
    "expenses.csv": toCsv([
      ["expense_number", (e) => e.number], ["date", (e) => e.spent_on], ["category", (e) => e.category?.name], ["description", (e) => e.description],
      ["vendor", (e) => e.vendor?.name], ["vendor_gstin", (e) => e.vendor?.gstin], ["paid_via", (e) => e.paid_via], ["amount", (e) => r(e.amount_paise)],
      ["gst", (e) => r(e.tax_paise)], ["status", (e) => e.status], ["void_reason", (e) => e.void_reason],
    ], data.expenses),
    "stock_valuation.csv": toCsv([
      ["as_of", () => data.to], ["product", (x) => x.name], ["sku", (x) => x.sku], ["category", (x) => x.category], ["qty", (x) => x.qty],
      ["unit_cost", (x) => r(x.costPaise)], ["value_at_cost", (x) => r(x.valuePaise)], ["price", (x) => r(x.price_paise)], ["value_at_price", (x) => r(x.valueAtPricePaise)],
    ], data.valuation.rows),
  };
}
