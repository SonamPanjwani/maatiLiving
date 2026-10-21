import "server-only";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// One search box for the whole admin: vendors, purchases (PO / bill number), payments, expenses, products, orders.
// Admin session client (RLS). Each group is optional: a table that doesn't exist yet just returns nothing.

// Remove characters that have meaning in PostgREST filter syntax before an OR search.
const clean = (q) => String(q ?? "").replace(/[%,()*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
const like = (columns, term) => columns.map((column) => `${column}.ilike.%${term}%`).join(",");
const rows = (promise) => promise.then(({ data, error }) => (error ? [] : data ?? []));

export async function adminSearch(q) {
  const term = clean(q);
  if (term.length < 2) return null;
  const supabase = createSupabaseServerClient();
  const digits = term.replace(/\D/g, "");
  const [vendors, purchases, payments, expenses, products, orders] = await Promise.all([
    rows(supabase.from("vendors").select("id, name, city, phone, status").or(like(["name", "contact_person", "city", "supplies", ...(digits.length >= 4 ? ["phone"] : [])], term)).order("name").limit(10)),
    rows(supabase.from("purchases").select("id, number, bill_number, status, total_paise, order_date, vendor:vendor_id(name)").or(like(["number", "bill_number"], term)).order("order_date", { ascending: false }).limit(10)),
    rows(supabase.from("vendor_payments").select("id, number, reference, amount_paise, paid_on, status, vendor:vendor_id(name)").or(like(["number", "reference"], term)).order("paid_on", { ascending: false }).limit(10)),
    rows(supabase.from("expenses").select("id, number, description, amount_paise, spent_on, status, category:category_id(name)").or(like(["number", "description"], term)).order("spent_on", { ascending: false }).limit(10)),
    rows(supabase.from("products").select("id, name, sku, stock, price_paise").or(like(["name", "sku", "slug"], term)).order("name").limit(10)),
    rows(supabase.from("orders").select("id, order_number, customer_name, email, status, payment_method, payment_reference, total_paise, created_at").or(like(["order_number", "customer_name", "email", ...(digits.length >= 4 ? ["phone"] : [])], term)).order("created_at", { ascending: false }).limit(10)),
  ]);
  return { term, vendors, purchases, payments, expenses, products, orders, count: vendors.length + purchases.length + payments.length + expenses.length + products.length + orders.length };
}
