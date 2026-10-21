// Books Phase 3 (0010): vendor payments, allocation (auto = JS mirror), void, re-allocate, guards, RLS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, CUSTOMER, as, createDb } from "./harness.mjs";
import { autoAllocate, openItems, vendorBalance } from "../../src/lib/books/payments.js";

const DIYA = "terracotta-diya-set-of-6";

const productId = async (db, slug) => (await db.query("select id from public.products where slug = $1", [slug])).rows[0].id;
const count = async (db, table) => (await db.query(`select count(*)::int n from public.${table}`)).rows[0].n;
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);

async function vendor(db, { name = "Potter", opening = 0 } = {}) {
  const r = await as(db, "authenticated", ADMIN, "insert into public.vendors (name, payment_terms_days, opening_balance_paise) values ($1, 15, $2) returning id", [name, opening]);
  assert.ok(r.rows?.[0]?.id, r.error);
  return r.rows[0].id;
}

// A billed purchase (payable without receiving) of qty × cost.
async function bill(db, vendorId, { qty = 1, cost, billNumber = "B-1", billDate = "2026-10-01" }) {
  const diya = await productId(db, DIYA);
  const r = await as(db, "authenticated", ADMIN, "select public.books_save_purchase(null, $1, $2::jsonb, $3::jsonb) as id",
    [vendorId, JSON.stringify({ bill_number: billNumber, bill_date: billDate, order_date: billDate }), JSON.stringify([{ product_id: diya, qty, unit_cost_paise: cost }])]);
  assert.ok(r.rows?.[0]?.id, r.error);
  return r.rows[0].id;
}

function pay(db, vendorId, { amount, paidOn = "2026-10-10", method = "upi", allocations = null, uid = ADMIN, extra = {} }) {
  return as(db, "authenticated", uid, "select public.books_record_payment($1, $2::jsonb, $3::jsonb) as id",
    [vendorId, JSON.stringify({ amount_paise: amount, paid_on: paidOn, method, reference: "UTR1", ...extra }), allocations === null ? null : JSON.stringify(allocations)]);
}

const allocationsOf = async (db, paymentId) => (await db.query(`select a.purchase_id, a.amount_paise from public.vendor_payment_allocations a
  where payment_id = $1 order by a.amount_paise desc`, [paymentId])).rows;

// Rows shaped like the app reads them.
async function vendorData(db, vendorId) {
  const v = (await db.query("select * from public.vendors where id = $1", [vendorId])).rows[0];
  const purchases = (await db.query("select * from public.purchases where vendor_id = $1", [vendorId])).rows
    .map((p) => ({ ...p, order_date: iso(p.order_date), bill_date: iso(p.bill_date), due_date: iso(p.due_date), created_at: p.created_at.toISOString() }));
  const payments = (await db.query("select * from public.vendor_payments where vendor_id = $1", [vendorId])).rows;
  const allocations = (await db.query(`select a.payment_id, a.purchase_id, a.amount_paise, p.status as payment_status from public.vendor_payment_allocations a
    join public.vendor_payments p on p.id = a.payment_id where p.vendor_id = $1`, [vendorId])).rows;
  return { v, purchases, payments, allocations };
}

test("auto-allocation: opening balance first, then oldest bill; leftover is an advance; JS mirror agrees", async () => {
  const db = await createDb();
  const vendorId = await vendor(db, { opening: 50000 });
  const newer = await bill(db, vendorId, { cost: 30000, billNumber: "B-2", billDate: "2026-10-05" });
  const older = await bill(db, vendorId, { cost: 20000, billNumber: "B-1", billDate: "2026-10-01" });

  // What the JS would propose for ₹900 before paying.
  const before = await vendorData(db, vendorId);
  const proposal = autoAllocate(90000, openItems({ openingBalancePaise: before.v.opening_balance_paise, purchases: before.purchases, allocations: before.allocations }));

  const r = await pay(db, vendorId, { amount: 90000 });
  assert.ok(r.rows?.[0]?.id, r.error);
  const paymentId = r.rows[0].id;
  const payment = (await db.query("select * from public.vendor_payments where id = $1", [paymentId])).rows[0];
  assert.equal(payment.number, "PAY-1001");
  assert.equal(payment.created_by, ADMIN);

  const rows = await allocationsOf(db, paymentId);
  const byTarget = Object.fromEntries(rows.map((a) => [a.purchase_id ?? "opening", a.amount_paise]));
  assert.deepEqual(byTarget, { opening: 50000, [older]: 20000, [newer]: 20000 }, "₹500 opening, ₹200 older bill (full), ₹200 of the newer ₹300 bill");
  assert.deepEqual(Object.fromEntries(proposal.allocations.map((a) => [a.key, a.amountPaise])), byTarget, "JS autoAllocate = SQL");
  assert.equal(proposal.advancePaise, 0);

  // Overpay: ₹100 left on the newer bill, pay ₹250 → ₹150 advance.
  const r2 = await pay(db, vendorId, { amount: 25000 });
  assert.deepEqual((await allocationsOf(db, r2.rows[0].id)).map((a) => [a.purchase_id, a.amount_paise]), [[newer, 10000]]);
  const after = await vendorData(db, vendorId);
  assert.equal(vendorBalance(after.v.opening_balance_paise, after.purchases, after.payments), -15000, "₹150 advance");
  assert.equal(openItems({ openingBalancePaise: 50000, purchases: after.purchases, allocations: after.allocations }).length, 0, "nothing left open");
});

test("explicit allocation: limits enforced, nothing half-saves", async () => {
  const db = await createDb();
  const vendorId = await vendor(db, { opening: 10000 });
  const other = await vendor(db, { name: "Other" });
  const b1 = await bill(db, vendorId, { cost: 20000 });
  const foreign = await bill(db, other, { cost: 20000 });
  const diya = await productId(db, DIYA);
  const draft = (await as(db, "authenticated", ADMIN, "select public.books_save_purchase(null, $1, '{}'::jsonb, $2::jsonb) as id",
    [vendorId, JSON.stringify([{ product_id: diya, qty: 1, unit_cost_paise: 5000 }])])).rows[0].id;

  let r = await pay(db, vendorId, { amount: 50000, allocations: [{ purchase_id: b1, amount_paise: 20001 }] });
  assert.match(r.error ?? "", /Only ₹200 is still to pay on PO-/);
  r = await pay(db, vendorId, { amount: 10000, allocations: [{ purchase_id: b1, amount_paise: 15000 }] });
  assert.match(r.error ?? "", /more than the payment/);
  r = await pay(db, vendorId, { amount: 50000, allocations: [{ purchase_id: foreign, amount_paise: 100 }] });
  assert.match(r.error ?? "", /isn't from this vendor/);
  r = await pay(db, vendorId, { amount: 50000, allocations: [{ purchase_id: draft, amount_paise: 100 }] });
  assert.match(r.error ?? "", /isn't a bill yet/);
  r = await pay(db, vendorId, { amount: 50000, allocations: [{ purchase_id: null, amount_paise: 10001 }] });
  assert.match(r.error ?? "", /Only ₹100 of the opening balance/);
  r = await pay(db, vendorId, { amount: 50000, allocations: [{ purchase_id: b1, amount_paise: 100 }, { purchase_id: b1, amount_paise: 100 }] });
  assert.match(r.error ?? "", /twice/);
  assert.equal(await count(db, "vendor_payments"), 0, "no payment left behind by a refused allocation");

  // Valid: part to the bill, nothing to opening, rest stays as advance.
  r = await pay(db, vendorId, { amount: 50000, allocations: [{ purchase_id: b1, amount_paise: 12000 }] });
  assert.ok(r.rows?.[0]?.id, r.error);
  assert.deepEqual((await allocationsOf(db, r.rows[0].id)).map((a) => [a.purchase_id, a.amount_paise]), [[b1, 12000]]);
  // Empty allocation = all advance.
  r = await pay(db, vendorId, { amount: 700, allocations: [] });
  assert.equal((await allocationsOf(db, r.rows[0].id)).length, 0);
});

test("void: drops out of totals, kept with reason; re-allocate moves an advance to a later bill", async () => {
  const db = await createDb();
  const vendorId = await vendor(db);
  const b1 = await bill(db, vendorId, { cost: 20000 });
  const p1 = (await pay(db, vendorId, { amount: 30000 })).rows[0].id; // ₹200 to b1, ₹100 advance

  let r = await as(db, "authenticated", ADMIN, "select public.books_void_payment($1, $2)", [p1, "x"]);
  assert.match(r.error ?? "", /reason/);
  r = await as(db, "authenticated", ADMIN, "select public.books_void_payment($1, $2)", [p1, "Paid twice by mistake"]);
  assert.equal(r.error, undefined);
  const voided = (await db.query("select * from public.vendor_payments where id = $1", [p1])).rows[0];
  assert.equal(voided.status, "voided");
  assert.equal(voided.void_reason, "Paid twice by mistake");
  assert.ok(voided.voided_at);
  assert.equal((await allocationsOf(db, p1)).length, 1, "allocations kept for the record");
  let data = await vendorData(db, vendorId);
  assert.equal(vendorBalance(0, data.purchases, data.payments), 20000, "voided payment doesn't count");
  assert.equal(openItems({ purchases: data.purchases, allocations: data.allocations })[0].balancePaise, 20000);
  r = await as(db, "authenticated", ADMIN, "select public.books_void_payment($1, $2)", [p1, "again"]);
  assert.match(r.error ?? "", /Only an active payment/);
  r = await as(db, "authenticated", ADMIN, "select public.books_set_payment_allocations($1, null)", [p1]);
  assert.match(r.error ?? "", /voided/);

  // Fresh payment ₹300 → ₹200 to b1, ₹100 advance; then a new bill arrives and the advance is applied.
  const p2 = (await pay(db, vendorId, { amount: 30000 })).rows[0].id;
  const b2 = await bill(db, vendorId, { cost: 15000, billNumber: "B-2", billDate: "2026-10-08" });
  r = await as(db, "authenticated", ADMIN, "select public.books_set_payment_allocations($1, null)", [p2]);
  assert.equal(r.error, undefined);
  assert.deepEqual(Object.fromEntries((await allocationsOf(db, p2)).map((a) => [a.purchase_id, a.amount_paise])), { [b1]: 20000, [b2]: 10000 });
  // Explicit re-allocation: everything to b2 up to its balance.
  r = await as(db, "authenticated", ADMIN, "select public.books_set_payment_allocations($1, $2::jsonb)", [p2, JSON.stringify([{ purchase_id: b2, amount_paise: 15000 }])]);
  assert.equal(r.error, undefined);
  assert.deepEqual((await allocationsOf(db, p2)).map((a) => [a.purchase_id, a.amount_paise]), [[b2, 15000]]);
  data = await vendorData(db, vendorId);
  assert.equal(vendorBalance(0, data.purchases, data.payments), 20000 + 15000 - 30000);
});

test("guards: paid bills can't be cancelled, un-billed or shrunk below paid; opening balance can't drop below paid", async () => {
  const db = await createDb();
  const vendorId = await vendor(db, { opening: 10000 });
  const b1 = await bill(db, vendorId, { qty: 2, cost: 10000 });
  await pay(db, vendorId, { amount: 25000 }); // ₹100 opening, ₹150 to b1
  const diya = await productId(db, DIYA);

  let r = await as(db, "authenticated", ADMIN, "select public.books_cancel_purchase($1, 'not needed')", [b1]);
  assert.match(r.error ?? "", /₹150 of payments is allocated/);
  r = await as(db, "authenticated", ADMIN, "select public.books_save_purchase($1, $2, $3::jsonb, $4::jsonb)",
    [b1, vendorId, JSON.stringify({ bill_number: "", order_date: "2026-10-01" }), JSON.stringify([{ product_id: diya, qty: 2, unit_cost_paise: 10000 }])]);
  assert.match(r.error ?? "", /needs its bill number/);
  r = await as(db, "authenticated", ADMIN, "select public.books_save_purchase($1, $2, $3::jsonb, $4::jsonb)",
    [b1, vendorId, JSON.stringify({ bill_number: "B-1", order_date: "2026-10-01" }), JSON.stringify([{ product_id: diya, qty: 1, unit_cost_paise: 10000 }])]);
  assert.match(r.error ?? "", /can't go below what's already been paid \(₹150\)/);
  assert.equal((await db.query("select total_paise from public.purchases where id = $1", [b1])).rows[0].total_paise, 20000, "rolled back");
  r = await as(db, "authenticated", ADMIN, "update public.vendors set opening_balance_paise = 5000 where id = $1", [vendorId]);
  assert.match(r.error ?? "", /allocated to the opening balance/);
  r = await as(db, "authenticated", ADMIN, "update public.vendors set opening_balance_paise = 12000 where id = $1", [vendorId]);
  assert.equal(r.error, undefined, "raising it is fine");
});

test("validation and security", async () => {
  const db = await createDb();
  const vendorId = await vendor(db);
  let r = await pay(db, vendorId, { amount: 0 });
  assert.match(r.error ?? "", /more than ₹0/);
  r = await pay(db, vendorId, { amount: 100, paidOn: "2999-01-01" });
  assert.match(r.error ?? "", /future/);
  r = await pay(db, vendorId, { amount: 100, method: "cheque" });
  assert.match(r.error ?? "", /how it was paid/);
  r = await pay(db, vendorId, { amount: 100, extra: { attachments: [{ publicId: "maati-living/products/x" }] } });
  assert.match(r.error ?? "", /private upload folder/);

  r = await pay(db, vendorId, { amount: 100, uid: CUSTOMER });
  assert.equal(r.code, "42501");
  r = await as(db, "authenticated", ADMIN, "insert into public.vendor_payments (number, vendor_id, amount_paise, paid_on, method) values ('PAY-9', $1, 1, '2026-10-01', 'upi')", [vendorId]);
  assert.equal(r.code, "42501", "no direct insert, even for admins");
  r = await pay(db, vendorId, { amount: 100 });
  assert.ok(r.rows?.[0]?.id, r.error);
  r = await as(db, "authenticated", CUSTOMER, "select count(*)::int n from public.vendor_payments");
  assert.equal(r.rows[0].n, 0, "customers see no payments");
  r = await as(db, "authenticated", CUSTOMER, "select public.books_void_payment((select id from public.vendor_payments limit 1), 'hack')");
  assert.ok(r.error, "customer can't void");
  r = await as(db, "anon", null, "select public.books_record_payment($1, '{}'::jsonb, null)", [vendorId]);
  assert.equal(r.code, "42501", "anon has no execute");

  await as(db, "authenticated", ADMIN, "update public.vendors set status = 'archived', archived_reason = 'gone' where id = $1", [vendorId]);
  r = await pay(db, vendorId, { amount: 100 });
  assert.match(r.error ?? "", /archived/);
  const audit = (await db.query("select count(*)::int n from public.audit_log where entity = 'vendor_payments' and actor_id = $1", [ADMIN])).rows[0].n;
  assert.ok(audit >= 1, "payments are audited with the admin's id");
});

test("demo seed runs on a fresh database (twice) and allocates the demo payments", async () => {
  const { readFileSync } = await import("node:fs");
  const db = await createDb();
  const seed = readFileSync(new URL("../../supabase/demo/books_demo_seed.sql", import.meta.url), "utf8");
  await db.exec(seed);
  await db.exec(seed); // safe to run again: nothing doubles
  assert.equal((await db.query("select count(*)::int n from public.vendor_payments where notes like 'DEMO%'")).rows[0].n, 2);
  const potters = (await db.query(`select a.purchase_id, a.amount_paise from public.vendor_payment_allocations a
    join public.vendor_payments p on p.id = a.payment_id where p.reference = 'DEMO-UTR-1' order by a.purchase_id nulls first`)).rows;
  assert.deepEqual(potters.map((a) => [a.purchase_id === null ? "opening" : "bill", a.amount_paise]), [["opening", 250000], ["bill", 50000]]);
  const advance = (await db.query(`select count(*)::int n from public.vendor_payment_allocations a
    join public.vendor_payments p on p.id = a.payment_id where p.notes = 'DEMO advance for testing'`)).rows[0].n;
  assert.equal(advance, 0, "shell artisans have no bill yet, so it's all advance");
});
