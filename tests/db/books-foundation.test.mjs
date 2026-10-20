// Books Phase 1 (0007): stock ledger, guard, adjustments, cost snapshot, audit log, vendors, RLS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, CUSTOMER, as, createDb, createOrder, stockOf } from "./harness.mjs";

const productId = async (db, slug) => (await db.query("select id from public.products where slug = $1", [slug])).rows[0].id;
const ledger = async (db, slug) => (await db.query(`select coalesce(sum(qty_change), 0)::int as n from public.stock_movements m
  join public.products p on p.id = m.product_id where p.slug = $1`, [slug])).rows[0].n;

test("backfill: every product's opening ledger equals its stock", async () => {
  const db = await createDb();
  for (const { slug, stock } of (await db.query("select slug, stock from public.products")).rows) {
    assert.equal(await ledger(db, slug), stock, slug);
  }
  const { rows } = await db.query("select distinct reason from public.stock_movements");
  assert.deepEqual(rows.map((r) => r.reason), ["opening_stock"]);
});

test("stock can't be changed directly — only through a movement", async () => {
  const db = await createDb();
  const before = await stockOf(db, "terracotta-diya-set-of-6");
  const r = await as(db, "authenticated", ADMIN, "update public.products set stock = 999 where slug = 'terracotta-diya-set-of-6'");
  assert.match(r.error ?? "", /Stock can only change through a stock movement/);
  assert.equal(await stockOf(db, "terracotta-diya-set-of-6"), before);
  const price = await as(db, "authenticated", ADMIN, "update public.products set price_paise = 47000 where slug = 'terracotta-diya-set-of-6' returning price_paise");
  assert.equal(price.rows?.[0]?.price_paise, 47000, "other product fields still editable");
});

test("new product with initial stock records an opening_stock movement", async () => {
  const db = await createDb();
  const r = await as(db, "authenticated", ADMIN, `insert into public.products (slug, name, price_paise, stock, category_id)
    select 'clay-lamp', 'Clay Lamp', 25000, 7, id from public.categories where slug = 'diyas' returning id`);
  assert.ok(r.rows?.[0]?.id, r.error);
  const m = (await db.query("select qty_change, reason, stock_after from public.stock_movements where product_id = $1", [r.rows[0].id])).rows;
  assert.deepEqual(m, [{ qty_change: 7, reason: "opening_stock", stock_after: 7 }]);
});

test("adjust stock: works, validates, and rolls back completely on failure", async () => {
  const db = await createDb();
  const id = await productId(db, "coconut-shell-agarbatti-stand");
  const s0 = await stockOf(db, "coconut-shell-agarbatti-stand");

  let r = await as(db, "authenticated", ADMIN, "select public.books_adjust_stock($1, 5, 'recount', 'found a box') as stock", [id]);
  assert.equal(r.rows?.[0]?.stock, s0 + 5, r.error);
  const m = (await db.query("select qty_change, reason, adjustment_reason, created_by from public.stock_movements where product_id = $1 and reason = 'manual_adjustment'", [id])).rows;
  assert.deepEqual(m, [{ qty_change: 5, reason: "manual_adjustment", adjustment_reason: "recount", created_by: ADMIN }]);

  const movementsBefore = (await db.query("select count(*)::int n from public.stock_movements")).rows[0].n;
  const auditBefore = (await db.query("select count(*)::int n from public.audit_log")).rows[0].n;
  r = await as(db, "authenticated", ADMIN, "select public.books_adjust_stock($1, -1000, 'damaged', null)", [id]);
  assert.match(r.error ?? "", /Not enough stock/);
  assert.equal(await stockOf(db, "coconut-shell-agarbatti-stand"), s0 + 5, "stock unchanged after failed adjustment");
  assert.equal((await db.query("select count(*)::int n from public.stock_movements")).rows[0].n, movementsBefore, "no movement written");
  assert.equal((await db.query("select count(*)::int n from public.audit_log")).rows[0].n, auditBefore, "no audit row written");

  r = await as(db, "authenticated", ADMIN, "select public.books_adjust_stock($1, 0, 'recount', null)", [id]);
  assert.match(r.error ?? "", /not 0/);
  r = await as(db, "authenticated", ADMIN, "select public.books_adjust_stock($1, 1, 'gift', null)", [id]);
  assert.match(r.error ?? "", /Choose a reason/);
  r = await as(db, "authenticated", ADMIN, "select public.books_adjust_stock($1, 1, 'other', '  ')", [id]);
  assert.match(r.error ?? "", /Add a note/);
  r = await as(db, "authenticated", CUSTOMER, "select public.books_adjust_stock($1, 1, 'recount', null)", [id]);
  assert.equal(r.code, "42501", "customer refused");
  r = await as(db, "anon", null, "select public.books_adjust_stock($1, 1, 'recount', null)", [id]);
  assert.ok(r.error, "anon refused");
  r = await as(db, "authenticated", ADMIN, `insert into public.stock_movements (product_id, qty_change, reason, stock_after) values ($1, 1, 'opening_stock', 1)`, [id]);
  assert.ok(r.error, "ledger can't be written directly, even by admin");
});

test("paid orders snapshot the unit cost and write order_paid movements", async () => {
  const db = await createDb();
  const id = await productId(db, "terracotta-diya-set-of-6");
  let r = await as(db, "authenticated", ADMIN, "select public.books_set_cost_price($1, 18000)", [id]);
  assert.ok(!r.error, r.error);
  const order = await createOrder(db, { lines: [{ slug: "terracotta-diya-set-of-6", quantity: 2 }], method: "upi_manual" });
  r = await as(db, "authenticated", ADMIN, "select public.admin_confirm_manual_payment($1) as ok", [order]);
  assert.equal(r.rows?.[0]?.ok, true, r.error);
  assert.equal((await db.query("select unit_cost_paise from public.order_items where order_id = $1", [order])).rows[0].unit_cost_paise, 18000);
  const m = (await db.query("select qty_change, reason, ref_type, ref_id from public.stock_movements where reason = 'order_paid'")).rows;
  assert.deepEqual(m, [{ qty_change: -2, reason: "order_paid", ref_type: "order", ref_id: order }]);

  r = await as(db, "authenticated", CUSTOMER, "select public.books_set_cost_price($1, 1)", [id]);
  assert.equal(r.code, "42501");
  r = await as(db, "authenticated", CUSTOMER, "select public.admin_confirm_manual_payment($1)", [order]);
  assert.equal(r.code, "42501", "rewritten function now RAISEs for non-admins");
  r = await as(db, "authenticated", CUSTOMER, "select public.admin_restock_order($1)", [order]);
  assert.equal(r.code, "42501");
});

test("audit log captures the admin's user id, and 'system' for payment-gateway writes", async () => {
  const db = await createDb();
  let r = await as(db, "authenticated", ADMIN, "insert into public.vendors (name, phone) values ('Kumhar Collective', '9876543210') returning id");
  const vendorId = r.rows?.[0]?.id;
  assert.ok(vendorId, r.error);
  await as(db, "authenticated", ADMIN, "update public.vendors set city = 'Raipur' where id = $1", [vendorId]);
  const vendorAudit = (await db.query("select actor_id, actor_kind, action from public.audit_log where entity = 'vendors' order by id")).rows;
  assert.deepEqual(vendorAudit, [
    { actor_id: ADMIN, actor_kind: "user", action: "insert" },
    { actor_id: ADMIN, actor_kind: "user", action: "update" },
  ]);

  await createOrder(db, { lines: [{ slug: "coconut-shell-hanging-planter", quantity: 1 }], razorpayOrderId: "order_A" });
  await as(db, "service_role", null, "select * from public.mark_order_paid('order_A', 'pay_A')");
  const sys = (await db.query("select actor_id, actor_kind from public.audit_log where entity = 'stock_movements' and after ->> 'reason' = 'order_paid'")).rows;
  assert.deepEqual(sys, [{ actor_id: null, actor_kind: "system" }]);

  r = await as(db, "authenticated", CUSTOMER, "select count(*)::int n from public.audit_log");
  assert.equal(r.rows?.[0]?.n, 0, "customers can't read the audit log");
  await as(db, "authenticated", ADMIN, "delete from public.audit_log");
  assert.ok((await db.query("select count(*)::int n from public.audit_log")).rows[0].n > 0, "audit log can't be deleted");
});

test("vendors: admin only, validated, archived never deleted; one preferred vendor per product", async () => {
  const db = await createDb();
  let r = await as(db, "authenticated", ADMIN, `insert into public.vendors (name, phone, gstin, bank_ifsc, payment_terms_days, opening_balance_paise)
    values ('Molela Potters', '9123456780', '22AAAAA0000A1Z5', 'HDFC0001234', 15, 250000) returning id`);
  const v1 = r.rows?.[0]?.id;
  assert.ok(v1, r.error);
  for (const [col, bad] of [["phone", "12345"], ["gstin", "22AAAAA0000"], ["bank_ifsc", "HDFC1234"], ["pan", "ABC"]]) {
    r = await as(db, "authenticated", ADMIN, `insert into public.vendors (name, ${col}) values ('X', $1)`, [bad]);
    assert.ok(r.error, `${col} '${bad}' rejected`);
  }
  r = await as(db, "authenticated", CUSTOMER, "select count(*)::int n from public.vendors");
  assert.equal(r.rows?.[0]?.n, 0, "customer sees no vendors");
  r = await as(db, "authenticated", CUSTOMER, "insert into public.vendors (name) values ('Hacker')");
  assert.ok(r.error, "customer can't add vendors");
  r = await as(db, "authenticated", ADMIN, "delete from public.vendors where id = $1 returning id", [v1]);
  assert.equal(r.rows?.length ?? 0, 0, "vendors can't be deleted");
  r = await as(db, "authenticated", ADMIN, "update public.vendors set status = 'archived', archived_reason = 'stopped supplying' where id = $1 returning status", [v1]);
  assert.equal(r.rows?.[0]?.status, "archived");

  const v2 = (await as(db, "authenticated", ADMIN, "insert into public.vendors (name) values ('Kerala Shell Works') returning id")).rows[0].id;
  const pid = await productId(db, "coconut-shell-hanging-planter");
  await as(db, "authenticated", ADMIN, "insert into public.vendor_products (vendor_id, product_id, last_cost_paise) values ($1, $3, 30000), ($2, $3, 28000)", [v1, v2, pid]);
  r = await as(db, "authenticated", ADMIN, "select public.books_set_preferred_vendor($1, $2)", [v1, pid]);
  assert.ok(!r.error, r.error);
  r = await as(db, "authenticated", ADMIN, "select public.books_set_preferred_vendor($1, $2)", [v2, pid]);
  assert.ok(!r.error, r.error);
  const preferred = (await db.query("select vendor_id from public.vendor_products where product_id = $1 and is_preferred", [pid])).rows;
  assert.deepEqual(preferred, [{ vendor_id: v2 }], "only the latest preferred vendor");
  r = await as(db, "authenticated", CUSTOMER, "select public.books_set_preferred_vendor($1, $2)", [v1, pid]);
  assert.equal(r.code, "42501");
});

test("products with stock history can't be hard-deleted", async () => {
  const db = await createDb();
  const r = await as(db, "authenticated", ADMIN, "delete from public.products where slug = 'terracotta-diya-set-of-6'");
  assert.ok(["23001", "23503"].includes(r.code), `foreign key keeps the history (got ${r.code})`);
});
