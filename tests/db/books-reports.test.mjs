// Books Phase 5: the stock valuation replay (JS, from the ledger) matches the live stock and cost price that the
// SQL functions produced after receipts, an order, an adjustment and a manual cost change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, as, createDb, createOrder } from "./harness.mjs";
import { stockValuation } from "../../src/lib/books/reports.js";
import { todayInIndia } from "../../src/lib/format.js";

test("stock valuation replay = live products after real operations", async () => {
  const db = await createDb();
  const ids = Object.fromEntries((await db.query("select slug, id from public.products")).rows.map((r) => [r.slug, r.id]));
  const diya = ids["terracotta-diya-set-of-6"];
  const planter = ids["coconut-shell-hanging-planter"];
  const ok = (r) => assert.equal(r.error, undefined, r.error);

  const vendor = (await as(db, "authenticated", ADMIN, "insert into public.vendors (name) values ('V') returning id")).rows[0].id;
  ok(await as(db, "authenticated", ADMIN, "select public.books_set_cost_price($1, 15000)", [planter]));
  // Two purchases at different costs (weighted average), one with shipping (landed cost).
  for (const [cost, ship] of [[20000, 3000], [26000, 0]]) {
    const r = await as(db, "authenticated", ADMIN, "select public.books_save_purchase(null, $1, $2::jsonb, $3::jsonb) as id",
      [vendor, JSON.stringify({ shipping_paise: ship }), JSON.stringify([{ product_id: diya, qty: 10, unit_cost_paise: cost }, { product_id: planter, qty: 3, unit_cost_paise: cost / 2 }])]);
    ok(r);
    const items = (await db.query("select id, qty_ordered from public.purchase_items where purchase_id = $1", [r.rows[0].id])).rows;
    ok(await as(db, "authenticated", ADMIN, "select public.books_receive_purchase($1, $2::jsonb)", [r.rows[0].id, JSON.stringify(items.map((i) => ({ item_id: i.id, qty: i.qty_ordered })))]));
  }
  const order = await createOrder(db, { lines: [{ slug: "terracotta-diya-set-of-6", quantity: 4 }], method: "upi_manual" });
  ok(await as(db, "authenticated", ADMIN, "select public.admin_confirm_manual_payment($1)", [order]));
  ok(await as(db, "authenticated", ADMIN, "select public.books_adjust_stock($1, -1, 'damaged', null)", [diya]));

  const products = (await db.query("select id, name, sku, price_paise, stock, cost_price_paise from public.products")).rows;
  const movements = (await db.query("select product_id, reason, qty_change, stock_after, unit_cost_paise, created_at from public.stock_movements")).rows
    .map((m) => ({ ...m, created_at: m.created_at.toISOString() }));
  const costChanges = (await db.query(`select entity_id as product_id, (after ->> 'cost_price_paise')::int as cost_paise, created_at from public.audit_log
    where entity = 'products' and action = 'update' and (before ->> 'cost_price_paise') is distinct from (after ->> 'cost_price_paise') order by id`)).rows
    .map((c) => ({ ...c, created_at: c.created_at.toISOString() }));
  const valuation = stockValuation(products, movements, todayInIndia(), costChanges);
  for (const product of products.filter((p) => p.stock > 0)) {
    const row = valuation.rows.find((r) => r.id === product.id);
    assert.equal(row?.qty, product.stock, `${product.name} qty`);
  }
  for (const id of [diya, planter]) {
    const live = products.find((p) => p.id === id);
    assert.equal(valuation.rows.find((r) => r.id === id).costPaise, live.cost_price_paise, `${live.name} cost`);
  }
});
