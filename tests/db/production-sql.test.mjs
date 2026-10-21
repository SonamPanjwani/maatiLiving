// supabase/production/all-in-one.sql: up to date with the migrations, and builds a working empty production DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptyDb } from "./harness.mjs";
import { productionSql } from "../../scripts/build-production-sql.mjs";

const file = readFileSync(new URL("../../supabase/production/all-in-one.sql", import.meta.url), "utf8");

test("all-in-one.sql matches the migrations (run `npm run sql:production` after adding one)", () => {
  assert.equal(file, productionSql());
});

test("all-in-one.sql builds an empty production database: every table, marked production, no sample data", async () => {
  const db = await createEmptyDb();
  await db.exec(file);
  const tables = (await db.query("select table_name from information_schema.tables where table_schema = 'public'")).rows.map((r) => r.table_name);
  for (const table of ["profiles", "categories", "products", "orders", "order_items", "addresses", "settings", "carts", "vendors", "stock_movements", "audit_log", "purchases", "purchase_items", "vendor_payments", "vendor_payment_allocations", "expense_categories", "expenses"]) {
    assert.ok(tables.includes(table), `${table} exists`);
  }
  assert.equal((await db.query("select value #>> '{}' as v from public.settings where key = 'environment'")).rows[0].v, "production");
  assert.equal((await db.query("select count(*)::int n from public.products")).rows[0].n, 0, "no sample products");
  assert.equal((await db.query("select count(*)::int n from public.categories")).rows[0].n, 0, "no sample categories");
  assert.equal((await db.query("select count(*)::int n from public.expense_categories")).rows[0].n, 10, "starter expense categories");
  const seed = readFileSync(new URL("../../supabase/demo/books_demo_seed.sql", import.meta.url), "utf8");
  await assert.rejects(db.exec(seed), /PRODUCTION database/, "demo seed refuses to run");
});
