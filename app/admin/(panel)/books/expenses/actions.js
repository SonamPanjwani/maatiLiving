"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/src/lib/auth";
import { validateExpense } from "@/src/lib/books/expenses";
import { todayInIndia } from "@/src/lib/format";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Expense and category actions. Every one starts with assertAdmin(); RLS / the SQL functions check is_admin()
// again and RAISE on any problem. Writes go through the signed-in session, so audit_log records the admin's id.

const text = (formData, key) => String(formData.get(key) ?? "").trim();
const expenseUrl = (id, params = {}) => `/admin/books/expenses/${id}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ""}`;
const categoriesUrl = (params = {}) => `/admin/books/expenses/categories?${new URLSearchParams(params)}`;

function friendly(error) {
  if (error.code === "42501") return "Not authorised.";
  if (error.code === "23505") return "There's already a category with that name.";
  if (error.code === "23514") return "Some details aren't in the right format. Please check and try again.";
  if (error.code === "22007" || error.code === "22008") return "Please enter a valid date.";
  return error.message;
}

function refresh() {
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------- expenses

// Create or edit. intent=another goes straight back to a fresh form (quick entry of several receipts).
export async function saveExpense(_prevState, formData) {
  await assertAdmin();
  const id = text(formData, "id") || null;
  const { data, error } = validateExpense(Object.fromEntries(formData), { today: todayInIndia() });
  if (error) return { error };
  const { data: savedId, error: saveError } = await createSupabaseServerClient().rpc("books_save_expense", { p_id: id, p_data: data });
  if (saveError) return { error: friendly(saveError) };
  refresh();
  if (!id && text(formData, "intent") === "another") {
    redirect(`/admin/books/expenses/new?${new URLSearchParams({ saved: savedId, on: data.spent_on, via: data.paid_via })}`);
  }
  redirect(expenseUrl(savedId, { saved: id ? "updated" : "added" }));
}

export async function voidExpense(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const reason = text(formData, "reason");
  if (reason.length < 3) redirect(expenseUrl(id, { error: "Please give a short reason for voiding." }));
  const { error } = await createSupabaseServerClient().rpc("books_void_expense", { p_id: id, p_reason: reason.slice(0, 300) });
  if (error) redirect(expenseUrl(id, { error: friendly(error) }));
  refresh();
  redirect(expenseUrl(id, { saved: "voided" }));
}

// Post one due occurrence of a repeating expense (amount / date / receipt as actually paid).
export async function confirmRecurring(_prevState, formData) {
  await assertAdmin();
  const sourceId = text(formData, "sourceId");
  const { data, error } = validateExpense(Object.fromEntries(formData), { today: todayInIndia(), occurrence: true });
  if (error) return { error };
  const { data: postedId, error: saveError } = await createSupabaseServerClient().rpc("books_confirm_recurring", {
    p_source_id: sourceId, p_due_on: text(formData, "dueOn"), p_data: data,
  });
  if (saveError) return { error: friendly(saveError) };
  refresh();
  redirect(expenseUrl(postedId, { saved: "confirmed" }));
}

export async function skipRecurring(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const back = text(formData, "back") === "dashboard" ? "/admin" : "/admin/books/expenses";
  const { error } = await createSupabaseServerClient().rpc("books_skip_recurring", { p_source_id: id, p_due_on: text(formData, "dueOn") });
  if (error) redirect(`${back}?${new URLSearchParams({ error: friendly(error) })}`);
  refresh();
  redirect(`${back}?saved=skipped`);
}

export async function stopRecurring(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const { error } = await createSupabaseServerClient().rpc("books_stop_recurring", { p_id: id });
  if (error) redirect(expenseUrl(id, { error: friendly(error) }));
  refresh();
  redirect(expenseUrl(id, { saved: "stopped" }));
}

// ---------------------------------------------------------------- categories

const categoryName = (formData) => text(formData, "name").replace(/\s+/g, " ").slice(0, 60);
const sortOrder = (formData) => {
  const value = Number(text(formData, "sortOrder") || 0);
  return Number.isInteger(value) && value >= 0 && value <= 10000 ? value : null;
};

export async function addExpenseCategory(formData) {
  await assertAdmin();
  const name = categoryName(formData);
  if (name.length < 2) redirect(categoriesUrl({ error: "Please enter a category name." }));
  const supabase = createSupabaseServerClient();
  const { data: last } = await supabase.from("expense_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("expense_categories").insert({ name, sort_order: (last?.sort_order ?? 0) + 10 });
  if (error) redirect(categoriesUrl({ error: friendly(error) }));
  refresh();
  redirect(categoriesUrl({ saved: "added" }));
}

export async function updateExpenseCategory(formData) {
  await assertAdmin();
  const name = categoryName(formData);
  const order = sortOrder(formData);
  if (name.length < 2) redirect(categoriesUrl({ error: "Please enter a category name." }));
  if (order === null) redirect(categoriesUrl({ error: "Order must be a whole number, 0 or more." }));
  const { error } = await createSupabaseServerClient().from("expense_categories").update({ name, sort_order: order }).eq("id", text(formData, "id"));
  if (error) redirect(categoriesUrl({ error: friendly(error) }));
  refresh();
  redirect(categoriesUrl({ saved: "updated" }));
}

export async function setExpenseCategoryStatus(formData) {
  await assertAdmin();
  const status = text(formData, "status") === "archived" ? "archived" : "active";
  const { error } = await createSupabaseServerClient().from("expense_categories").update({ status }).eq("id", text(formData, "id"));
  if (error) redirect(categoriesUrl({ error: friendly(error) }));
  refresh();
  redirect(categoriesUrl({ saved: status }));
}
