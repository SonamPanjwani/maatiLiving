// Books Phase 5: P&L, product margin, payables ageing, stock valuation, cash flow, statement range, CSV.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cashFlow, istBounds, istMonth, monthEnd, monthsBetween, payablesAgeing, pctChange, productMargins, profitAndLoss,
  statementForRange, stockValuation,
} from "../../src/lib/books/reports.js";
import { vendorStatement } from "../../src/lib/books/payments.js";
import { csvCell, toCsv } from "../../src/lib/csv.js";

test("IST months and bounds", () => {
  assert.equal(istMonth("2026-09-30T19:00:00Z"), "2026-10", "00:30 IST on 1 Oct is October");
  assert.equal(istMonth("2026-09-30T18:00:00Z"), "2026-09");
  assert.deepEqual(istBounds("2026-10-01", "2026-10-31"), { fromTs: "2026-10-01T00:00:00+05:30", toTs: "2026-11-01T00:00:00+05:30" });
  assert.deepEqual(monthsBetween("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.equal(monthsBetween("2020-01", "2026-12").length, 24, "capped");
  assert.equal(monthEnd("2028-02"), "2028-02-29");
  assert.equal(pctChange(150, 100), 50);
  assert.equal(pctChange(50, 0), null);
});

test("profit & loss: sales + delivery − COGS = gross; − expenses by category = net", () => {
  const orders = [
    { paid_at: "2026-09-10T06:00:00Z", subtotal_paise: 100000, shipping_paise: 9900, order_items: [{ quantity: 2, unit_cost_paise: 20000 }, { quantity: 1, unit_cost_paise: null }] },
    { paid_at: "2026-10-02T06:00:00Z", subtotal_paise: 50000, shipping_paise: 0, order_items: [{ quantity: 5, unit_cost_paise: 4000 }] },
    { paid_at: "2026-08-02T06:00:00Z", subtotal_paise: 99999, shipping_paise: 0, order_items: [] }, // outside the range
  ];
  const expenses = [
    { spent_on: "2026-09-12", amount_paise: 15000, category: { name: "Packaging" } },
    { spent_on: "2026-10-01", amount_paise: 30000, category: { name: "Ads & marketing" } },
    { spent_on: "2026-10-03", amount_paise: 5000, category: { name: "Packaging" } },
  ];
  const pl = profitAndLoss({ orders, expenses, months: ["2026-09", "2026-10"] });
  const [sep, oct] = pl.columns;
  assert.deepEqual([sep.salesPaise, sep.deliveryPaise, sep.revenuePaise, sep.cogsPaise, sep.uncostedUnits, sep.grossPaise, sep.expensesPaise, sep.netPaise],
    [100000, 9900, 109900, 40000, 1, 69900, 15000, 54900]);
  assert.deepEqual([oct.revenuePaise, oct.cogsPaise, oct.grossPaise, oct.expensesPaise, oct.netPaise], [50000, 20000, 30000, 35000, -5000], "a loss month");
  assert.deepEqual(oct.expenses, { "Ads & marketing": 30000, Packaging: 5000 });
  assert.equal(pl.total.netPaise, 54900 - 5000);
  assert.equal(pl.total.orders, 2);
  assert.deepEqual(pl.categories, ["Ads & marketing", "Packaging"], "biggest first (30000 vs 20000)");
  assert.equal(pl.total.grossMarginPct, Math.round((99900 / 159900) * 1000) / 10);
});

test("product margin: per product and category; margin only over costed lines", () => {
  const { products, categories } = productMargins([
    { product_id: "d", product_name: "Diya", category: "Diyas", quantity: 3, unit_price_paise: 45000, unit_cost_paise: 18000 },
    { product_id: "d", product_name: "Diya", category: "Diyas", quantity: 1, unit_price_paise: 45000, unit_cost_paise: null },
    { product_id: "p", product_name: "Planter", category: "Coconut shell", quantity: 2, unit_price_paise: 60000, unit_cost_paise: 30000 },
  ]);
  const diya = products.find((p) => p.key === "d");
  assert.deepEqual([diya.units, diya.revenuePaise, diya.cogsPaise, diya.uncostedUnits, diya.grossPaise, diya.marginPct], [4, 180000, 54000, 1, 81000, 60]);
  assert.equal(products[0].key, "d", "biggest revenue first");
  assert.deepEqual(categories.map((c) => [c.name, c.marginPct]), [["Diyas", 60], ["Coconut shell", 50]]);
});

test("payables ageing by bill date, opening balance from its own date", () => {
  const v = { id: "v", name: "Potters" };
  const w = { id: "w", name: "Shells" };
  const { rows, totals, totalPaise } = payablesAgeing([
    { vendor: v, date: "2026-10-01", balancePaise: 100 },   // 20 days
    { vendor: v, date: "2026-08-21", balancePaise: 200 },   // 61 days
    { vendor: v, date: null, balancePaise: 300 },           // opening, from 2026-01-01 → 90+
    { vendor: w, date: "2026-09-21", balancePaise: 400 },   // 30 days
    { vendor: w, date: "2026-09-20", balancePaise: 0 },     // settled
  ], "2026-10-21", new Map([["v", "2026-01-01"]]));
  assert.deepEqual(rows.map((r) => [r.vendor.name, r.buckets, r.totalPaise]), [["Potters", [100, 0, 200, 300], 600], ["Shells", [400, 0, 0, 0], 400]]);
  assert.deepEqual(totals, [500, 0, 200, 300]);
  assert.equal(totalPaise, 1000);
});

test("stock valuation replays the ledger up to the date (weighted cost on receipts)", () => {
  const products = [{ id: "d", name: "Diya", price_paise: 45000 }, { id: "p", name: "Planter", price_paise: 60000 }];
  const moves = [
    { product_id: "d", reason: "opening_stock", qty_change: 10, stock_after: 10, unit_cost_paise: null, created_at: "2026-09-01T04:00:00Z" },
    { product_id: "d", reason: "purchase_receipt", qty_change: 10, stock_after: 20, unit_cost_paise: 20000, created_at: "2026-09-05T04:00:00Z" },
    { product_id: "d", reason: "purchase_receipt", qty_change: 20, stock_after: 40, unit_cost_paise: 26000, created_at: "2026-09-10T04:00:00Z" },
    { product_id: "d", reason: "order_paid", qty_change: -4, stock_after: 36, unit_cost_paise: 23000, created_at: "2026-09-12T04:00:00Z" },
    { product_id: "p", reason: "opening_stock", qty_change: 3, stock_after: 3, unit_cost_paise: null, created_at: "2026-09-01T04:00:00Z" },
    { product_id: "d", reason: "purchase_receipt", qty_change: 4, stock_after: 40, unit_cost_paise: 99999, created_at: "2026-10-20T19:00:00Z" }, // 21 Oct IST
  ];
  let v = stockValuation(products, moves, "2026-09-11");
  const diya = v.rows.find((r) => r.id === "d");
  // 10 @ unknown → first receipt sets ₹200; then (20×200 + 20×260)/40 = ₹230.
  assert.deepEqual([diya.qty, diya.costPaise, diya.valuePaise], [40, 23000, 920000]);
  assert.equal(v.uncosted, 1, "planter has no cost");
  assert.equal(v.valueAtPricePaise, 40 * 45000 + 3 * 60000);
  v = stockValuation(products, moves, "2026-10-20");
  assert.equal(v.rows.find((r) => r.id === "d").qty, 36, "a move at 00:30 IST on the 21st isn't in the 20th");
});

test("cash flow: in = paid − refunds; out = vendor payments + expenses", () => {
  const rows = cashFlow({
    months: ["2026-09", "2026-10"],
    orders: [{ paid_at: "2026-09-05T05:00:00Z", total_paise: 50000 }, { paid_at: "2026-09-25T05:00:00Z", total_paise: 20000, refund_amount_paise: 20000, refunded_at: "2026-10-02T05:00:00Z" }],
    payments: [{ paid_on: "2026-09-10", amount_paise: 30000 }],
    expenses: [{ spent_on: "2026-10-01", amount_paise: 5000 }],
  });
  assert.deepEqual(rows.map((r) => [r.month, r.moneyInPaise, r.moneyOutPaise, r.netPaise]), [["2026-09", 70000, 30000, 40000], ["2026-10", -20000, 5000, -25000]]);
});

test("statement for a date range: earlier lines roll into the opening balance", () => {
  const statement = vendorStatement({
    vendor: { opening_balance_paise: 1000 },
    purchases: [{ id: "a", number: "PO-1", status: "received", total_paise: 5000, bill_date: "2026-09-01", order_date: "2026-09-01", bill_number: null, created_at: "2026-09-01T00:00:00Z" },
      { id: "b", number: "PO-2", status: "received", total_paise: 3000, bill_date: "2026-10-05", order_date: "2026-10-05", bill_number: null, created_at: "2026-10-05T00:00:00Z" }],
    payments: [{ id: "x", number: "PAY-1", status: "active", amount_paise: 2000, paid_on: "2026-09-15", method: "upi", created_at: "2026-09-15T00:00:00Z" },
      { id: "y", number: "PAY-2", status: "active", amount_paise: 1000, paid_on: "2026-11-01", method: "upi", created_at: "2026-11-01T00:00:00Z" }],
  });
  const range = statementForRange(statement, "2026-10-01", "2026-10-31");
  assert.equal(range.openingPaise, 1000 + 5000 - 2000);
  assert.deepEqual(range.lines.map((l) => [l.label, l.balancePaise]), [["PO-2", 7000]]);
  assert.deepEqual([range.billedPaise, range.paidPaise, range.closingPaise], [3000, 0, 7000]);
});

test("CSV: quoted, formula-safe, BOM", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("-5"), "\"'-5\"");
  assert.equal(csvCell(null), '""');
  assert.equal(toCsv([["A", (r) => r.a], ["B", (r) => r.b]], [{ a: 1, b: "x,y" }]), '﻿"A","B"\r\n"1","x,y"');
});
