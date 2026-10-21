// Books Phase 4 (0011): expense categories, expenses, void, recurring (confirm / skip / stop), RLS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, CUSTOMER, as, createDb } from "./harness.mjs";
import { nextDueDate } from "../../src/lib/books/expenses.js";

const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
const today = async (db) => iso((await db.query("select (now() at time zone 'Asia/Kolkata')::date as d")).rows[0].d);
const categoryId = async (db, name) => (await db.query("select id from public.expense_categories where name = $1", [name])).rows[0].id;
const expense = async (db, id) => (await db.query("select * from public.expenses where id = $1", [id])).rows[0];

function save(db, data, { id = null, uid = ADMIN } = {}) {
  return as(db, "authenticated", uid, "select public.books_save_expense($1, $2::jsonb) as id", [id, JSON.stringify(data)]);
}

test("categories: seeded, admin-managed, unique names, no delete", async () => {
  const db = await createDb();
  const names = (await db.query("select name from public.expense_categories order by sort_order")).rows.map((r) => r.name);
  assert.deepEqual(names, ["Packaging", "Courier & shipping", "Ads & marketing", "Photography", "Website & software", "Travel", "Rent", "Utilities", "Bank & payment charges", "Miscellaneous"]);
  let r = await as(db, "authenticated", ADMIN, "insert into public.expense_categories (name, sort_order) values ('Stalls & fairs', 110) returning id");
  assert.ok(r.rows?.[0]?.id, r.error);
  r = await as(db, "authenticated", ADMIN, "insert into public.expense_categories (name) values (' packaging ')");
  assert.equal(r.code, "23505", "names are unique, ignoring case and spaces");
  r = await as(db, "authenticated", ADMIN, "update public.expense_categories set status = 'archived' where name = 'Travel'");
  assert.equal(r.error, undefined);
  r = await as(db, "authenticated", ADMIN, "delete from public.expense_categories where name = 'Rent' returning id");
  assert.equal(r.rows?.length ?? 0, 0, "no delete");
  r = await as(db, "authenticated", CUSTOMER, "select count(*)::int n from public.expense_categories");
  assert.equal(r.rows[0].n, 0, "customers see none");
  r = await as(db, "authenticated", CUSTOMER, "insert into public.expense_categories (name) values ('Hack')");
  assert.ok(r.error, "customers can't add");
});

test("save: create, edit, validation, archived category, numbering", async () => {
  const db = await createDb();
  const packaging = await categoryId(db, "Packaging");
  const day = await today(db);
  const base = { category_id: packaging, amount_paise: 45050, tax_paise: 6872, spent_on: day, paid_via: "upi", description: " Boxes " };
  let r = await save(db, base);
  assert.ok(r.rows?.[0]?.id, r.error);
  const id = r.rows[0].id;
  let e = await expense(db, id);
  assert.equal(e.number, "EXP-1001");
  assert.equal(e.description, "Boxes");
  assert.equal(e.created_by, ADMIN);
  assert.equal(e.is_recurring, false);

  r = await save(db, { ...base, amount_paise: 50000 }, { id });
  assert.equal(r.error, undefined);
  assert.equal((await expense(db, id)).amount_paise, 50000);

  for (const [bad, message] of [
    [{ amount_paise: 0 }, /more than ₹0/], [{ tax_paise: 99999 }, /Tax can't be more/], [{ spent_on: "2999-01-01" }, /future/],
    [{ paid_via: "cheque" }, /how it was paid/], [{ category_id: null }, /category/], [{ description: "x".repeat(301) }, /too long/],
    [{ attachments: [{ publicId: "maati-living/products/x" }] }, /private upload folder/],
    [{ is_recurring: true, recurrence: "weekly" }, /how often/],
    [{ is_recurring: true, recurrence: "monthly", next_due_on: day }, /must be after/],
  ]) {
    r = await save(db, { ...base, ...bad });
    assert.match(r.error ?? "", message, JSON.stringify(bad));
  }
  assert.equal((await db.query("select count(*)::int n from public.expenses")).rows[0].n, 1, "nothing half-saved");

  await as(db, "authenticated", ADMIN, "update public.expense_categories set status = 'archived' where id = $1", [packaging]);
  r = await save(db, base);
  assert.match(r.error ?? "", /category/, "archived category can't take new expenses");
  r = await save(db, { ...base, amount_paise: 51000 }, { id });
  assert.equal(r.error, undefined, "an existing expense keeps its archived category");

  r = await save(db, base, { uid: CUSTOMER });
  assert.equal(r.code, "42501");
  r = await as(db, "authenticated", ADMIN, "insert into public.expenses (number, category_id, amount_paise, spent_on, paid_via) values ('EXP-9', $1, 1, now(), 'upi')", [packaging]);
  assert.equal(r.code, "42501", "no direct insert, even for admins");
  r = await as(db, "authenticated", CUSTOMER, "select count(*)::int n from public.expenses");
  assert.equal(r.rows[0].n, 0, "customers see no expenses");
});

test("void: kept with reason, can't edit after; voiding a repeating one stops it", async () => {
  const db = await createDb();
  const rent = await categoryId(db, "Rent");
  const day = await today(db);
  const id = (await save(db, { category_id: rent, amount_paise: 1500000, spent_on: day, paid_via: "bank", is_recurring: true, recurrence: "monthly" })).rows[0].id;
  let r = await as(db, "authenticated", ADMIN, "select public.books_void_expense($1, 'no')", [id]);
  assert.match(r.error ?? "", /reason/);
  r = await as(db, "authenticated", ADMIN, "select public.books_void_expense($1, 'Entered on the wrong month')", [id]);
  assert.equal(r.error, undefined);
  const e = await expense(db, id);
  assert.equal(e.status, "voided");
  assert.equal(e.is_recurring, false);
  assert.equal(e.next_due_on, null);
  r = await save(db, { category_id: rent, amount_paise: 1, spent_on: day, paid_via: "bank" }, { id });
  assert.match(r.error ?? "", /voided/);
  r = await as(db, "authenticated", ADMIN, "select public.books_void_expense($1, 'again')", [id]);
  assert.match(r.error ?? "", /Only an active/);
});

test("recurring: next date from the start (no month-end drift), confirm posts once, skip, stop; JS mirror agrees", async () => {
  // Pure date series check, DB vs JS.
  const db = await createDb();
  for (const [start, after, rec] of [["2026-01-31", "2026-01-31", "monthly"], ["2026-01-31", "2026-02-28", "monthly"], ["2026-01-31", "2026-03-31", "monthly"],
    ["2024-02-29", "2024-02-29", "yearly"], ["2024-02-29", "2025-02-28", "yearly"], ["2026-10-15", "2027-01-20", "monthly"]]) {
    const sql = iso((await db.query("select public._next_due($1::date, $2::date, $3) as d", [start, after, rec])).rows[0].d);
    assert.equal(nextDueDate(start, after, rec), sql, `${start} after ${after} ${rec}`);
  }
  assert.equal(nextDueDate("2026-01-31", "2026-02-28", "monthly"), "2026-03-31", "back to the 31st");

  const software = await categoryId(db, "Website & software");
  const day = await today(db);
  // A template that started two months ago → its first due date has passed.
  const start = iso((await db.query("select ((now() at time zone 'Asia/Kolkata')::date - interval '2 months')::date as d")).rows[0].d);
  const id = (await save(db, { category_id: software, amount_paise: 99900, spent_on: start, paid_via: "card", description: "Shop hosting", is_recurring: true, recurrence: "monthly" })).rows[0].id;
  let t = await expense(db, id);
  const due1 = iso(t.next_due_on);
  assert.equal(due1, nextDueDate(start, start, "monthly"), "blank next date = one month after");

  const occurrence = { category_id: software, amount_paise: 105000, spent_on: day, paid_via: "card", description: "Shop hosting (price went up)" };
  let r = await as(db, "authenticated", ADMIN, "select public.books_confirm_recurring($1, $2::date, $3::jsonb) as id", [id, due1, JSON.stringify(occurrence)]);
  assert.ok(r.rows?.[0]?.id, r.error);
  const posted = await expense(db, r.rows[0].id);
  assert.equal(posted.recurring_source_id, id);
  assert.equal(posted.amount_paise, 105000, "amount can differ from the template");
  assert.equal(posted.is_recurring, false);
  t = await expense(db, id);
  const due2 = iso(t.next_due_on);
  assert.equal(due2, nextDueDate(start, due1, "monthly"));

  r = await as(db, "authenticated", ADMIN, "select public.books_confirm_recurring($1, $2::date, $3::jsonb) as id", [id, due1, JSON.stringify(occurrence)]);
  assert.match(r.error ?? "", /already been confirmed/, "a double tap can't post twice");
  assert.equal((await db.query("select count(*)::int n from public.expenses where recurring_source_id = $1", [id])).rows[0].n, 1);

  r = await save(db, { ...occurrence, is_recurring: true, recurrence: "monthly" }, { id: posted.id });
  assert.match(r.error ?? "", /posted from a repeating one/);

  r = await as(db, "authenticated", ADMIN, "select public.books_skip_recurring($1, $2::date) as d", [id, due2]);
  assert.equal(iso(r.rows?.[0]?.d), nextDueDate(start, due2, "monthly"), r.error);
  const due3 = iso((await expense(db, id)).next_due_on);
  if (due3 > (await db.query("select ((now() at time zone 'Asia/Kolkata')::date + 7)::text as d")).rows[0].d) {
    r = await as(db, "authenticated", ADMIN, "select public.books_confirm_recurring($1, $2::date, $3::jsonb)", [id, due3, JSON.stringify(occurrence)]);
    assert.match(r.error ?? "", /isn't due yet/);
  }

  r = await as(db, "authenticated", CUSTOMER, "select public.books_skip_recurring($1, $2::date)", [id, due3]);
  assert.equal(r.code, "42501");
  r = await as(db, "authenticated", ADMIN, "select public.books_stop_recurring($1)", [id]);
  assert.equal(r.error, undefined);
  t = await expense(db, id);
  assert.equal(t.is_recurring, false);
  assert.equal(t.status, "active", "stopping keeps the expense itself");
  r = await as(db, "authenticated", ADMIN, "select public.books_confirm_recurring($1, $2::date, $3::jsonb)", [id, due3, JSON.stringify(occurrence)]);
  assert.match(r.error ?? "", /doesn't repeat/);
});
