// Test database: real Postgres (PGlite, in-process) with a minimal stand-in for Supabase's auth schema
// and default grants, then the project's migrations applied in order. Test-only (dev dependency).
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = new URL("../../supabase/migrations/", import.meta.url);
const SEED = new URL("../../supabase/seed.sql", import.meta.url);

export const ADMIN = "11111111-1111-1111-1111-111111111111";
export const CUSTOMER = "22222222-2222-2222-2222-222222222222";

// upTo: migration prefix to stop at (inclusive), e.g. "0006". Seed (catalogue) runs right after 0001.
export async function createDb({ upTo = "9999" } = {}) {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
  `);
  const files = readdirSync(MIGRATIONS_DIR).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
  for (const name of files) {
    if (name.slice(0, 4) > upTo) break;
    await db.exec(readFileSync(new URL(name, MIGRATIONS_DIR), "utf8"));
    if (name.startsWith("0001")) await db.exec(readFileSync(SEED, "utf8"));
  }
  await db.exec(`insert into auth.users (id, email) values ('${ADMIN}', 'owner@example.com'), ('${CUSTOMER}', 'buyer@example.com');
    update public.profiles set role = 'admin' where email = 'owner@example.com';`);
  return db;
}

// Run SQL as a role (and signed-in user). Returns { rows } or { error, code } — never throws.
export async function as(db, role, uid, sql, params) {
  await db.exec(`set role ${role}; select set_config('request.jwt.sub', '${uid ?? ""}', false);`);
  try {
    return { rows: (await db.query(sql, params)).rows };
  } catch (error) {
    return { error: error.message, code: error.code };
  } finally {
    await db.exec("reset role; select set_config('request.jwt.sub', '', false);");
  }
}

export const stockOf = async (db, slug) => (await db.query("select stock from public.products where slug = $1", [slug])).rows[0].stock;

// A pending order with the given lines ({ slug, quantity }), created like the server does (service role).
export async function createOrder(db, { lines, method = "razorpay", razorpayOrderId = null }) {
  const { rows } = await db.query(`insert into public.orders (customer_name, email, phone, address_line1, city, state, pincode,
      subtotal_paise, shipping_paise, total_paise, payment_method, razorpay_order_id)
    values ('Test', 't@example.com', '9876543210', '1 Road', 'Pune', 'Maharashtra', '411001', 100, 0, 100, $1, $2) returning id`, [method, razorpayOrderId]);
  const orderId = rows[0].id;
  for (const line of lines) {
    await db.query(`insert into public.order_items (order_id, product_id, product_name, unit_price_paise, quantity)
      select $1, id, name, price_paise, $2 from public.products where slug = $3`, [orderId, line.quantity, line.slug]);
  }
  return orderId;
}
