import { notFound } from "next/navigation";
import ExpenseForm from "@/components/books/ExpenseForm";
import { booksGetExpense, booksGetExpenseFormData } from "@/src/lib/books/data";
import { todayInIndia } from "@/src/lib/format";

export default async function EditExpensePage({ params }) {
  const expense = await booksGetExpense(params.id);
  if (!expense) notFound();
  const { categories, vendors } = await booksGetExpenseFormData({ includeCategoryId: expense.category_id, includeVendorId: expense.vendor_id });
  const back = `/admin/books/expenses/${expense.id}`;

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS · EXPENSE {expense.number}</p><h1>Edit expense</h1></div>
      <a className="text-link" href={back}>Back</a>
    </div>
    {expense.status === "voided"
      ? <p className="admin-note">This expense is voided and can't be changed.</p>
      : <ExpenseForm mode="edit" expense={expense} categories={categories} vendors={vendors} today={todayInIndia()} cancelHref={back} />}
  </>;
}
