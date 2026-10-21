// Books Phase 5: reorder drafts, report filters, CA export pack.
import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, unzipSync, zipSync } from "fflate";
import { reorderGroups, suggestedQty } from "../../src/lib/books/reorder.js";
import { reportParams } from "../../src/lib/books/report-params.js";
import { caPackFiles } from "../../src/lib/books/report-csv.js";

test("reorder: grouped by preferred vendor, qty back to twice the alert level, needs a price", () => {
  assert.equal(suggestedQty(2, 5), 8);
  assert.equal(suggestedQty(0, 0), 1, "always at least one");
  const potters = { id: "v1", name: "Potters" };
  const { groups, noVendor } = reorderGroups([
    { id: "a", name: "Diya", stock: 2, lowStockAt: 5, costPaise: null, preferredVendor: potters },
    { id: "b", name: "Lamp", stock: 1, lowStockAt: 5, costPaise: 9000, preferredVendor: potters },
    { id: "c", name: "Bowl", stock: 0, lowStockAt: 5, costPaise: null, preferredVendor: potters },
    { id: "d", name: "Planter", stock: 3, lowStockAt: 5, costPaise: 100, preferredVendor: null },
    { id: "e", name: "Plenty", stock: 50, lowStockAt: 5, costPaise: 100, preferredVendor: potters },
  ], [{ vendor_id: "v1", product_id: "a", last_cost_paise: 18000 }]);
  assert.deepEqual(groups.map((g) => [g.vendor.name, g.lines.map((l) => [l.name, l.qty, l.unitCostPaise]), g.missingCost]),
    [["Potters", [["Diya", 8, 18000], ["Lamp", 9, 9000]], ["Bowl"]]]);
  assert.deepEqual(noVendor, ["Planter"]);
});

test("report params: safe defaults, swapped ranges, no future dates", () => {
  const now = new Date("2026-10-21T06:00:00Z");
  const p = reportParams({}, now);
  assert.deepEqual([p.today, p.from, p.to, p.fromMonth, p.toMonth, p.asOf, p.caMonth], ["2026-10-21", "2026-10-01", "2026-10-21", "2026-05", "2026-10", "2026-10-21", "2026-09"]);
  const q = reportParams({ from: "2026-10-10", to: "2026-09-01", fromMonth: "2026-12", toMonth: "2026-01", asOf: "2099-01-01", month: "2099-01" }, now);
  assert.deepEqual([q.from, q.to, q.fromMonth, q.toMonth, q.asOf, q.caMonth], ["2026-09-01", "2026-10-10", "2026-01", "2026-12", "2026-10-21", "2026-09"]);
  assert.equal(reportParams({ from: "nonsense", month: "2026-13" }, now).from, "2026-10-01");
});

test("CA pack: six CSVs with stable snake_case headers; zips and unzips", () => {
  const files = caPackFiles({
    to: "2026-09-30",
    orders: [{ order_number: "ML1001", paid_at: "2026-09-05T05:00:00Z", status: "paid", payment_method: "razorpay", customer_name: "=cmd", state: "Goa", subtotal_paise: 45000, shipping_paise: 9900, total_paise: 54900, order_items: [{ product_name: "Diya", quantity: 2, unit_price_paise: 22500, unit_cost_paise: 9000 }] }],
    purchases: [{ number: "PO-1001", vendor: { name: "Potters" }, status: "received", order_date: "2026-09-01", subtotal_paise: 1000, discount_paise: 0, shipping_paise: 0, tax_paise: 0, total_paise: 1000, purchase_items: [{ qty_ordered: 1, qty_received: 1, unit_cost_paise: 1000, line_total_paise: 1000, product: { name: "Diya" } }] }],
    payments: [{ number: "PAY-1001", paid_on: "2026-09-10", vendor: { name: "Potters" }, amount_paise: 1500, method: "upi", status: "active", allocations: [{ amount_paise: 1000, purchase: { number: "PO-1001" } }, { amount_paise: 500, purchase: null }] }],
    expenses: [{ number: "EXP-1001", spent_on: "2026-09-12", category: { name: "Packaging" }, amount_paise: 15050, tax_paise: 0, paid_via: "upi", status: "active" }],
    valuation: { rows: [{ name: "Diya", qty: 3, costPaise: 9000, valuePaise: 27000, price_paise: 22500, valueAtPricePaise: 67500 }] },
  });
  assert.deepEqual(Object.keys(files), ["sales.csv", "purchases.csv", "purchase_items.csv", "vendor_payments.csv", "expenses.csv", "stock_valuation.csv"]);
  const header = (name) => files[name].replace(/^﻿/, "").split("\r\n")[0];
  assert.match(header("sales.csv"), /^"order_number","paid_date","status",.*"cogs","items"$/);
  assert.match(files["sales.csv"], /"ML1001","2026-09-05","paid","razorpay","","'=cmd","Goa","450.00","99.00","549.00","","","180.00","Diya x 2"/, "rupees, IST date, formula-safe, COGS");
  assert.match(files["vendor_payments.csv"], /"PO-1001: 10.00; opening balance: 5.00"/);
  assert.match(files["expenses.csv"], /"150.50"/);
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));
  assert.deepEqual(unzipSync(zip)["stock_valuation.csv"], strToU8(files["stock_valuation.csv"]), "bytes round-trip, BOM included");
});
