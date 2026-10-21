import { notFound } from "next/navigation";
import ExpenseForm from "@/components/books/ExpenseForm";
import { booksGetExpense, booksGetExpenseFormData } from "@/src/lib/books/data";
import { RECURRENCE } from "@/src/lib/books/expenses";
import { formatDate, todayInIndia } from "@/src/lib/format";

// Confirm one due payment of a repeating expense: the form starts with last time's amount and details.
export default async function ConfirmRecurringPage({ params }) {
  const expense = await booksGetExpense(params.id);
  if (!expense) notFound();
  const back = `/admin/books/expenses/${expense.id}`;
  const active = expense.is_recurring && expense.status === "active";
  const { categories, vendors } = active ? await booksGetExpenseFormData({ includeCategoryId: expense.category_id, includeVendorId: expense.vendor_id }) : {};

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS · REPEATING EXPENSE</p><h1>Confirm paid</h1>
        {active && <p className="admin-note">{expense.description || expense.category?.name} · {RECURRENCE[expense.recurrence]?.toLowerCase()} · due {formatDate(expense.next_due_on)}. Change the amount if it was different this time.</p>}</div>
      <a className="text-link" href={back}>Back</a>
    </div>
    {active
      ? <ExpenseForm mode="confirm" expense={expense} dueOn={expense.next_due_on} categories={categories} vendors={vendors} today={todayInIndia()} cancelHref={back} />
      : <p className="admin-note">This expense doesn't repeat any more. <a className="inline-link" href={back}>Open it</a>.</p>}
  </>;
}
