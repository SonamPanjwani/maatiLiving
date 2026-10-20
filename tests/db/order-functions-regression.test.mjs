// Regression: the 3 order stock functions rewritten in 0007 (mark_order_paid, admin_confirm_manual_payment,
// admin_restock_order) must leave products.stock exactly as the 0006 versions did, scenario by scenario.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, as, createDb, createOrder } from "./harness.mjs";

const allStock = async (db) => (await db.query("select slug, stock from public.products order by slug")).rows;

// Setting a test stock level directly: allowed before 0007; after 0007 only with the stock-write flag.
async function forceStock(db, slug, stock) {
  await db.exec("select set_config('maati.stock_write', 'on', false)");
  await db.query("update public.products set stock = $1 where slug = $2", [stock, slug]);
  await db.exec("select set_config('maati.stock_write', 'off', false)");
}

async function runScenario(db) {
  const snapshots = [];
  const snap = async (label) => snapshots.push({ label, stock: await allStock(db) });
  await snap("start");

  // 1. Razorpay order paid (twice — second call must not change stock).
  await createOrder(db, { lines: [{ slug: "terracotta-diya-set-of-6", quantity: 2 }, { slug: "coconut-shell-hanging-planter", quantity: 1 }], razorpayOrderId: "order_R1" });
  await as(db, "service_role", null, "select * from public.mark_order_paid('order_R1', 'pay_R1')");
  await snap("razorpay paid");
  await as(db, "service_role", null, "select * from public.mark_order_paid('order_R1', 'pay_R1')");
  await snap("razorpay paid again (no-op)");

  // 2. Direct UPI order confirmed by admin (twice).
  const upi = await createOrder(db, { lines: [{ slug: "coconut-shell-agarbatti-stand", quantity: 3 }], method: "upi_manual" });
  await as(db, "authenticated", ADMIN, "select public.admin_confirm_manual_payment($1)", [upi]);
  await snap("upi confirmed");
  await as(db, "authenticated", ADMIN, "select public.admin_confirm_manual_payment($1)", [upi]);
  await snap("upi confirmed again (no-op)");

  // 3. Oversold: only 2 in stock, order of 5 → stock goes to 0, never negative.
  await forceStock(db, "coconut-shell-hanging-planter", 2);
  await snap("planter forced to 2");
  await createOrder(db, { lines: [{ slug: "coconut-shell-hanging-planter", quantity: 5 }], razorpayOrderId: "order_R2" });
  await as(db, "service_role", null, "select * from public.mark_order_paid('order_R2', 'pay_R2')");
  await snap("oversold order paid");

  // 4. Cancel the UPI order and restock (twice).
  await as(db, "authenticated", ADMIN, "update public.orders set status = 'cancelled' where id = $1", [upi]);
  await as(db, "authenticated", ADMIN, "select public.admin_restock_order($1)", [upi]);
  await snap("upi cancelled + restocked");
  await as(db, "authenticated", ADMIN, "select public.admin_restock_order($1)", [upi]);
  await snap("restock again (no-op)");

  // 5. Unpaid order cancelled → restock must not add anything.
  const unpaid = await createOrder(db, { lines: [{ slug: "terracotta-diya-set-of-6", quantity: 4 }], method: "upi_manual" });
  await as(db, "authenticated", ADMIN, "update public.orders set status = 'cancelled' where id = $1", [unpaid]);
  await as(db, "authenticated", ADMIN, "select public.admin_restock_order($1)", [unpaid]);
  await snap("unpaid cancelled, restock attempted");

  // 6. Refunded Razorpay order restocked.
  await as(db, "authenticated", ADMIN, "update public.orders set status = 'refunded' where razorpay_order_id = 'order_R1'");
  const r1 = (await db.query("select id from public.orders where razorpay_order_id = 'order_R1'")).rows[0].id;
  await as(db, "authenticated", ADMIN, "select public.admin_restock_order($1)", [r1]);
  await snap("refunded + restocked");

  return snapshots;
}

test("rewritten order functions give the same stock results as before (0006 vs 0007)", async () => {
  const before = await runScenario(await createDb({ upTo: "0006" }));
  const after = await runScenario(await createDb({ upTo: "0007" }));
  assert.equal(after.length, before.length);
  for (let i = 0; i < before.length; i += 1) {
    assert.deepEqual(after[i].stock, before[i].stock, `stock differs after step "${before[i].label}"`);
  }
});

test("after 0007 the stock ledger matches products.stock through the whole scenario", async () => {
  const db = await createDb({ upTo: "0007" });
  await runScenario(db);
  const { rows } = await db.query(`select p.slug, p.stock, coalesce(sum(m.qty_change), 0)::int as ledger
    from public.products p left join public.stock_movements m on m.product_id = p.id group by p.slug, p.stock`);
  // forceStock bypasses the ledger on purpose (test setup only), so allow exactly that one planter override.
  for (const row of rows.filter((r) => r.slug !== "coconut-shell-hanging-planter")) {
    assert.equal(row.ledger, row.stock, `${row.slug}: ledger ${row.ledger} vs stock ${row.stock}`);
  }
});
