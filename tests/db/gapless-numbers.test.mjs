// 0012: PO / PAY / EXP numbers are gapless (a refused save doesn't use a number) and messages show ₹ like
// formatPrice (Indian grouping).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, as, createDb } from "./harness.mjs";
import { formatPrice } from "../../src/lib/format.js";

test("_rupees matches formatPrice (Indian grouping, paise only when non-zero)", async () => {
  const db = await createDb();
  for (const paise of [0, 5, 100, 99900, 601000, 12345650, 1000000000, 100000000000]) {
    const { rows } = await db.query("select public._rupees($1) as r", [paise]);
    assert.equal(rows[0].r, formatPrice(paise), `${paise} paise`);
  }
});

test("a refused save doesn't use up a number; the next good one takes it", async () => {
  const db = await createDb();
  const vendor = (await as(db, "authenticated", ADMIN, "insert into public.vendors (name) values ('V') returning id")).rows[0].id;
  const diya = (await db.query("select id from public.products where slug = 'terracotta-diya-set-of-6'")).rows[0].id;
  const pay = (amount, allocations) => as(db, "authenticated", ADMIN, "select public.books_record_payment($1, $2::jsonb, $3::jsonb) as id",
    [vendor, JSON.stringify({ amount_paise: amount, paid_on: "2026-10-10", method: "upi" }), allocations ? JSON.stringify(allocations) : null]);
  const bill = (await as(db, "authenticated", ADMIN, "select public.books_save_purchase(null, $1, $2::jsonb, $3::jsonb) as id",
    [vendor, JSON.stringify({ bill_number: "B1" }), JSON.stringify([{ product_id: diya, qty: 1, unit_cost_paise: 601000 }])])).rows[0].id;

  // Refused after the payment row was inserted (allocation over the bill) — rolls back, number included.
  let r = await pay(700000, [{ purchase_id: bill, amount_paise: 700000 }]);
  assert.match(r.error ?? "", /Only ₹6,010 is still to pay on PO-1001/, "₹ with grouping in the message");
  r = await as(db, "authenticated", ADMIN, "select public.books_save_purchase(null, $1, '{}'::jsonb, '[]'::jsonb)", [vendor]);
  assert.ok(r.error, "refused purchase");
  r = await as(db, "authenticated", ADMIN, "select public.books_save_expense(null, $1::jsonb)", [JSON.stringify({ amount_paise: 0 })]);
  assert.ok(r.error, "refused expense");

  r = await pay(1000);
  const payment = (await db.query("select number from public.vendor_payments where id = $1", [r.rows[0].id])).rows[0];
  assert.equal(payment.number, "PAY-1001", "no gap after the refused payment");
  r = await as(db, "authenticated", ADMIN, "select public.books_save_purchase(null, $1, '{}'::jsonb, $2::jsonb) as id", [vendor, JSON.stringify([{ product_id: diya, qty: 1, unit_cost_paise: 100 }])]);
  assert.equal((await db.query("select number from public.purchases where id = $1", [r.rows[0].id])).rows[0].number, "PO-1002");
  const category = (await db.query("select id from public.expense_categories where name = 'Packaging'")).rows[0].id;
  const today = (await db.query("select ((now() at time zone 'Asia/Kolkata')::date)::text as d")).rows[0].d;
  r = await as(db, "authenticated", ADMIN, "select public.books_save_expense(null, $1::jsonb) as id", [JSON.stringify({ category_id: category, amount_paise: 100, spent_on: today, paid_via: "cash" })]);
  assert.equal((await db.query("select number from public.expenses where id = $1", [r.rows[0].id])).rows[0].number, "EXP-1001");
  r = await as(db, "authenticated", ADMIN, "select public._next_number('payment')");
  assert.equal(r.code, "42501", "not callable from the API");
});

test("counters start after the highest number already used (existing databases)", async () => {
  const db = await createDb({ upTo: "0011" });
  const vendor = (await db.query("insert into public.vendors (name) values ('V') returning id")).rows[0].id;
  await db.query("insert into public.vendor_payments (number, vendor_id, amount_paise, paid_on, method) values ('PAY-1007', $1, 1, '2026-10-01', 'upi')", [vendor]);
  const { readFileSync } = await import("node:fs");
  await db.exec(readFileSync(new URL("../../supabase/migrations/0012_gapless_numbers.sql", import.meta.url), "utf8"));
  const counters = Object.fromEntries((await db.query("select kind, last_number from public.document_counters")).rows.map((r) => [r.kind, r.last_number]));
  assert.deepEqual(counters, { purchase: 1000, payment: 1007, expense: 1000 });
  const r = await as(db, "authenticated", ADMIN, "select public.books_record_payment($1, $2::jsonb, null) as id", [vendor, JSON.stringify({ amount_paise: 5, paid_on: "2026-10-10", method: "cash" })]);
  assert.equal((await db.query("select number from public.vendor_payments where id = $1", [r.rows[0].id])).rows[0].number, "PAY-1008");
});
