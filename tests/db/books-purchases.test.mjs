// Books Phase 2 (0008): purchases, receiving, landed + weighted average cost, locks, cancel, RLS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, CUSTOMER, as, createDb, stockOf } from "./harness.mjs";
import { landedUnitCost, weightedAverageCost } from "../../src/lib/books/purchases.js";

const DIYA = "terracotta-diya-set-of-6";
const PLANTER = "coconut-shell-hanging-planter";

const productId = async (db, slug) => (await db.query("select id from public.products where slug = $1", [slug])).rows[0].id;
const product = async (db, slug) => (await db.query("select stock, cost_price_paise from public.products where slug = $1", [slug])).rows[0];
const purchase = async (db, id) => (await db.query("select * from public.purchases where id = $1", [id])).rows[0];
const items = async (db, id) => (await db.query(`select pi.*, p.slug from public.purchase_items pi join public.products p on p.id = pi.product_id
  where purchase_id = $1 order by sort_order`, [id])).rows;
const count = async (db, table) => (await db.query(`select count(*)::int n from public.${table}`)).rows[0].n;

async function vendor(db, { name = "Potter", terms = 15 } = {}) {
  const r = await as(db, "authenticated", ADMIN, "insert into public.vendors (name, payment_terms_days) values ($1, $2) returning id", [name, terms]);
  assert.ok(r.rows?.[0]?.id, r.error);
  return r.rows[0].id;
}

function save(db, { id = null, vendorId, header = {}, lines, uid = ADMIN }) {
  return as(db, "authenticated", uid, "select public.books_save_purchase($1, $2, $3::jsonb, $4::jsonb) as id",
    [id, vendorId, JSON.stringify(header), lines === null ? null : JSON.stringify(lines)]);
}

function receive(db, id, lines, { note = null, allowOver = false, uid = ADMIN } = {}) {
  return as(db, "authenticated", uid, "select public.books_receive_purchase($1, $2::jsonb, $3, $4) as status",
    [id, JSON.stringify(lines), note, allowOver]);
}

async function setup() {
  const db = await createDb();
  const vendorId = await vendor(db);
  const diya = await productId(db, DIYA);
  const planter = await productId(db, PLANTER);
  return { db, vendorId, diya, planter };
}

test("save: sequential PO numbers, server-side totals, due date from vendor terms", async () => {
  const { db, vendorId, diya, planter } = await setup();
  let r = await save(db, {
    vendorId,
    header: { order_date: "2026-10-01", bill_number: "B-77", bill_date: "2026-10-05", discount_paise: 2000, shipping_paise: 5000, tax_paise: 1000 },
    lines: [{ product_id: diya, qty: 10, unit_cost_paise: 10000 }, { product_id: planter, qty: 4, unit_cost_paise: 25050 }],
  });
  assert.ok(r.rows?.[0]?.id, r.error);
  const p1 = await purchase(db, r.rows[0].id);
  assert.equal(p1.number, "PO-1001");
  assert.equal(p1.status, "draft");
  assert.equal(p1.subtotal_paise, 10 * 10000 + 4 * 25050);
  assert.equal(p1.total_paise, 200200 - 2000 + 5000 + 1000);
  assert.equal(p1.due_date.toISOString().slice(0, 10), "2026-10-20", "bill date + 15 days");
  assert.equal(p1.created_by, ADMIN);

  r = await save(db, { vendorId, header: { mark_ordered: true }, lines: [{ product_id: diya, qty: 1, unit_cost_paise: 100 }] });
  const p2 = await purchase(db, r.rows[0].id);
  assert.equal(p2.number, "PO-1002");
  assert.equal(p2.status, "ordered");
  assert.ok(p2.ordered_at);

  // Edit before anything is received: lines replaced, totals recomputed.
  r = await save(db, { id: p1.id, vendorId, header: { discount_paise: 0 }, lines: [{ product_id: diya, qty: 3, unit_cost_paise: 9900 }] });
  assert.equal(r.error, undefined);
  assert.deepEqual((await items(db, p1.id)).map((i) => [i.slug, i.qty_ordered, i.line_total_paise]), [[DIYA, 3, 29700]]);
  assert.equal((await purchase(db, p1.id)).total_paise, 29700 + 5000 + 1000, "amounts left out of the header are kept");
});

test("save: validation rolls back everything; customers and direct writes are refused", async () => {
  const { db, vendorId, diya, planter } = await setup();
  const before = await count(db, "purchases");
  let r = await save(db, { vendorId, lines: [{ product_id: diya, qty: 2, unit_cost_paise: 100 }, { product_id: planter, qty: 0, unit_cost_paise: 100 }] });
  assert.match(r.error ?? "", /whole number above 0/);
  r = await save(db, { vendorId, lines: [{ product_id: diya, qty: 2, unit_cost_paise: 100 }, { product_id: diya, qty: 1, unit_cost_paise: 100 }] });
  assert.match(r.error ?? "", /twice/);
  r = await save(db, { vendorId, header: { discount_paise: 999 }, lines: [{ product_id: diya, qty: 1, unit_cost_paise: 100 }] });
  assert.match(r.error ?? "", /discount can't be more/);
  r = await save(db, { vendorId, lines: [] });
  assert.match(r.error ?? "", /at least one item/);
  r = await save(db, { vendorId, header: { bill_attachments: [{ publicId: "maati-living/products/x" }] }, lines: [{ product_id: diya, qty: 1, unit_cost_paise: 1 }] });
  assert.match(r.error ?? "", /bills upload folder/);
  assert.equal(await count(db, "purchases"), before, "no half-saved purchase");
  assert.equal(await count(db, "purchase_items"), 0);

  r = await save(db, { vendorId, uid: CUSTOMER, lines: [{ product_id: diya, qty: 1, unit_cost_paise: 1 }] });
  assert.equal(r.code, "42501");
  r = await as(db, "authenticated", ADMIN, "insert into public.purchases (number, vendor_id) values ('PO-9', $1)", [vendorId]);
  assert.equal(r.code, "42501", "no direct insert, even for admins");
  r = await as(db, "authenticated", CUSTOMER, "select count(*)::int n from public.purchases");
  assert.equal(r.rows[0].n, 0, "customers see no purchases");

  await as(db, "authenticated", ADMIN, "update public.vendors set status = 'archived', archived_reason = 'gone' where id = $1", [vendorId]);
  r = await save(db, { vendorId, lines: [{ product_id: diya, qty: 1, unit_cost_paise: 1 }] });
  assert.match(r.error ?? "", /active vendor/);
});

test("receive: stock in, landed cost, weighted average, status, vendor's last cost, ledger", async () => {
  const { db, vendorId, diya, planter } = await setup();
  await as(db, "authenticated", ADMIN, "select public.books_set_cost_price($1, 9000)", [planter]);
  const d0 = await product(db, DIYA);
  const p0 = await product(db, PLANTER);
  assert.equal(d0.cost_price_paise, null, "diya cost not set yet");

  const header = { discount_paise: 2000, shipping_paise: 5000, tax_paise: 1000, mark_ordered: true };
  const { rows: [{ id }] } = await save(db, { vendorId, header, lines: [{ product_id: diya, qty: 10, unit_cost_paise: 10000 }, { product_id: planter, qty: 4, unit_cost_paise: 25050 }] });
  const [lineDiya, linePlanter] = await items(db, id);

  // Partial: 6 diyas.
  let r = await receive(db, id, [{ item_id: lineDiya.id, qty: 6 }, { item_id: linePlanter.id, qty: 0 }]);
  assert.equal(r.rows?.[0]?.status, "partially_received", r.error);
  const subtotal = 200200;
  const landedDiya = landedUnitCost(10000, { subtotalPaise: subtotal, shippingPaise: 5000, discountPaise: 2000 });
  assert.equal(landedDiya, 10150, "₹100 + its share of (₹50 shipping − ₹20 discount) = ₹101.50");
  let d = await product(db, DIYA);
  assert.equal(d.stock, d0.stock + 6);
  assert.equal(d.cost_price_paise, landedDiya, "first receipt sets the cost when it wasn't known");

  // Rest: 4 diyas + 4 planters.
  r = await receive(db, id, [{ item_id: lineDiya.id, qty: 4 }, { item_id: linePlanter.id, qty: 4 }], { note: "second box" });
  assert.equal(r.rows?.[0]?.status, "received", r.error);
  const landedPlanter = landedUnitCost(25050, { subtotalPaise: subtotal, shippingPaise: 5000, discountPaise: 2000 });
  d = await product(db, DIYA);
  const p = await product(db, PLANTER);
  assert.equal(d.stock, d0.stock + 10);
  assert.equal(d.cost_price_paise, weightedAverageCost(d0.stock + 6, landedDiya, 4, landedDiya));
  assert.equal(p.stock, p0.stock + 4);
  assert.equal(p.cost_price_paise, weightedAverageCost(p0.stock, 9000, 4, landedPlanter), "SQL weighted average matches JS");

  const pu = await purchase(db, id);
  assert.ok(pu.received_at);
  const moves = (await db.query("select qty_change, unit_cost_paise, note, created_by from public.stock_movements where ref_type = 'purchase' and ref_id = $1 order by created_at, qty_change", [id])).rows;
  assert.deepEqual(moves.map((m) => m.qty_change).sort(), [4, 4, 6]);
  assert.ok(moves.every((m) => m.created_by === ADMIN));
  assert.ok(moves.some((m) => m.note === "PO-1001" || m.note === "Received on PO-1001"));
  assert.ok(moves.some((m) => m.note === "second box"));

  const links = (await db.query("select product_id, last_cost_paise from public.vendor_products where vendor_id = $1 order by last_cost_paise", [vendorId])).rows;
  assert.deepEqual(links.map((l) => l.last_cost_paise), [10000, 25050], "links created with the vendor's price (not landed)");

  // Fully received: nothing more to receive.
  r = await receive(db, id, [{ item_id: lineDiya.id, qty: 1 }], { allowOver: true });
  assert.match(r.error ?? "", /nothing left to receive/);

  // Ledger still equals stock for every product.
  const off = (await db.query(`select p.slug from public.products p left join public.stock_movements m on m.product_id = p.id
    group by p.id, p.slug, p.stock having coalesce(sum(m.qty_change), 0) <> p.stock`)).rows;
  assert.deepEqual(off, []);
});

test("receive more than ordered: refused without confirmation, then billed for what arrived", async () => {
  const { db, vendorId, diya } = await setup();
  const s0 = await stockOf(db, DIYA);
  const { rows: [{ id }] } = await save(db, { vendorId, lines: [{ product_id: diya, qty: 10, unit_cost_paise: 5000 }] });
  const [line] = await items(db, id);

  const movesBefore = await count(db, "stock_movements");
  let r = await receive(db, id, [{ item_id: line.id, qty: 12 }]);
  assert.match(r.error ?? "", /More than ordered/);
  assert.equal(await stockOf(db, DIYA), s0, "nothing received");
  assert.equal(await count(db, "stock_movements"), movesBefore);
  assert.equal((await items(db, id))[0].qty_received, 0);

  r = await receive(db, id, [{ item_id: line.id, qty: 12 }], { allowOver: true });
  assert.equal(r.rows?.[0]?.status, "received", r.error);
  assert.equal(await stockOf(db, DIYA), s0 + 12);
  const [after] = await items(db, id);
  assert.equal(after.line_total_paise, 12 * 5000);
  assert.equal((await purchase(db, id)).total_paise, 60000);
});

test("receive: bad input rolls back, other purchases' items and customers refused", async () => {
  const { db, vendorId, diya, planter } = await setup();
  const { rows: [{ id: a }] } = await save(db, { vendorId, lines: [{ product_id: diya, qty: 5, unit_cost_paise: 100 }] });
  const { rows: [{ id: b }] } = await save(db, { vendorId, lines: [{ product_id: planter, qty: 5, unit_cost_paise: 100 }] });
  const [lineA] = await items(db, a);
  const [lineB] = await items(db, b);
  const s0 = await stockOf(db, DIYA);

  let r = await receive(db, a, [{ item_id: lineA.id, qty: 2 }, { item_id: lineB.id, qty: 1 }]);
  assert.match(r.error ?? "", /doesn't belong/);
  assert.equal(await stockOf(db, DIYA), s0, "first line rolled back too");
  r = await receive(db, a, [{ item_id: lineA.id, qty: 0 }]);
  assert.match(r.error ?? "", /at least one item/);
  r = await receive(db, a, [{ item_id: lineA.id, qty: -1 }]);
  assert.match(r.error ?? "", /0 or more/);
  r = await receive(db, a, [{ item_id: lineA.id, qty: 1 }], { uid: CUSTOMER });
  assert.equal(r.code, "42501");
  assert.equal((await purchase(db, a)).status, "draft");
});

test("after receiving: no cancel, no line or amount edits — bill details and notes still editable", async () => {
  const { db, vendorId, diya } = await setup();
  const { rows: [{ id }] } = await save(db, { vendorId, header: { shipping_paise: 500 }, lines: [{ product_id: diya, qty: 5, unit_cost_paise: 100 }] });
  const [line] = await items(db, id);
  await receive(db, id, [{ item_id: line.id, qty: 2 }]);

  let r = await as(db, "authenticated", ADMIN, "select public.books_cancel_purchase($1, 'changed mind')", [id]);
  assert.match(r.error ?? "", /can't be cancelled/);
  r = await save(db, { id, vendorId, lines: [{ product_id: diya, qty: 9, unit_cost_paise: 100 }] });
  assert.match(r.error ?? "", /can't be edited after stock has been received/);
  r = await save(db, { id, vendorId, header: { shipping_paise: 900 }, lines: null });
  assert.match(r.error ?? "", /locked/);
  r = await save(db, { id, vendorId, header: { bill_number: "INV-9", bill_date: "2026-10-10", notes: "2 broken, adjusted" }, lines: null });
  assert.equal(r.error, undefined);
  const pu = await purchase(db, id);
  assert.equal(pu.bill_number, "INV-9");
  assert.equal(pu.shipping_paise, 500, "amounts unchanged");
  assert.equal(pu.due_date.toISOString().slice(0, 10), "2026-10-25");
});

test("cancel: needs a reason, only before receiving; cancelled purchases are frozen", async () => {
  const { db, vendorId, diya } = await setup();
  const { rows: [{ id }] } = await save(db, { vendorId, header: { mark_ordered: true }, lines: [{ product_id: diya, qty: 5, unit_cost_paise: 100 }] });
  let r = await as(db, "authenticated", ADMIN, "select public.books_cancel_purchase($1, ' ')", [id]);
  assert.match(r.error ?? "", /reason/);
  r = await as(db, "authenticated", CUSTOMER, "select public.books_cancel_purchase($1, 'nope nope')", [id]);
  assert.equal(r.code, "42501");
  r = await as(db, "authenticated", ADMIN, "select public.books_cancel_purchase($1, 'vendor out of stock')", [id]);
  assert.equal(r.error, undefined);
  const pu = await purchase(db, id);
  assert.equal(pu.status, "cancelled");
  assert.equal(pu.cancelled_reason, "vendor out of stock");
  r = await save(db, { id, vendorId, header: { notes: "x" }, lines: null });
  assert.match(r.error ?? "", /cancelled/);
  const [line] = await items(db, id);
  r = await receive(db, id, [{ item_id: line.id, qty: 1 }]);
  assert.match(r.error ?? "", /nothing left to receive/);
  r = await as(db, "authenticated", ADMIN, "delete from public.purchases where id = $1", [id]);
  assert.equal(r.code, "42501", "purchases are never deleted");
});

test("cost price must be more than ₹0 (null clears it)", async () => {
  const { db, diya } = await setup();
  let r = await as(db, "authenticated", ADMIN, "select public.books_set_cost_price($1, 0)", [diya]);
  assert.match(r.error ?? "", /more than ₹0/);
  r = await as(db, "authenticated", ADMIN, "select public.books_set_cost_price($1, 1)", [diya]);
  assert.equal(r.error, undefined);
  r = await as(db, "authenticated", ADMIN, "select public.books_set_cost_price($1, null)", [diya]);
  assert.equal(r.error, undefined);
});

test("SQL costing helpers agree with the JS versions", async () => {
  const db = await createDb();
  let seed = 7;
  const rand = (max) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % max; };
  for (let i = 0; i < 300; i++) {
    const unit = rand(100000);
    const subtotal = unit + rand(5000000);
    const discount = rand(subtotal + 1);
    const shipping = rand(200000);
    const totalQty = 1 + rand(500);
    const [oldStock, oldCost, qty] = [rand(300), i % 5 === 0 ? null : rand(100000), 1 + rand(300)];
    const { rows: [sql] } = await db.query("select public._landed_unit_cost($1, $2, $3, $4, $5) as landed, public._weighted_cost($6, $7, $8, $1) as avg",
      [unit, subtotal, shipping, discount, totalQty, oldStock, oldCost, qty]);
    assert.equal(sql.landed, landedUnitCost(unit, { subtotalPaise: subtotal, shippingPaise: shipping, discountPaise: discount, totalQty }), `landed #${i}`);
    assert.equal(sql.avg, weightedAverageCost(oldStock, oldCost, qty, unit), `weighted #${i}`);
  }
  for (const [s, c, q, l] of [[0, null, 5, 100], [10, null, 5, 100], [10, 100, 10, 201], [3, 333, 1, 334], [7, 1000, 3, 0], [0, 500, 2, 700]]) {
    const { rows: [{ avg }] } = await db.query("select public._weighted_cost($1, $2, $3, $4) as avg", [s, c, q, l]);
    assert.equal(avg, weightedAverageCost(s, c, q, l), `weighted ${[s, c, q, l]}`);
  }
  const { rows: [{ zero }] } = await db.query("select public._landed_unit_cost(0, 0, 900, 0, 3) as zero");
  assert.equal(zero, landedUnitCost(0, { subtotalPaise: 0, shippingPaise: 900, totalQty: 3 }));
  assert.equal(zero, 300);
});
