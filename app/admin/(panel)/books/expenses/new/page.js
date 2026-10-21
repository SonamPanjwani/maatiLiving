import ExpenseForm from "@/components/books/ExpenseForm";
import { booksGetExpense, booksGetExpenseFormData } from "@/src/lib/books/data";
import { PAID_VIA, validDate } from "@/src/lib/books/expenses";
import { formatPrice, todayInIndia } from "@/src/lib/format";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewExpensePage({ searchParams }) {
  const today = todayInIndia();
  // After "Save & add another": keep the last receipt's date and payment method.
  const defaults = {
    spentOn: validDate(searchParams?.on) && searchParams.on <= today ? searchParams.on : undefined,
    paidVia: PAID_VIA[searchParams?.via] ? searchParams.via : undefined,
  };
  const [{ categories, vendors }, saved] = await Promise.all([
    booksGetExpenseFormData(),
    UUID.test(searchParams?.saved ?? "") ? booksGetExpense(searchParams.saved) : null,
  ]);

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS · EXPENSES</p><h1>Add expense</h1></div>
      <a className="text-link" href="/admin/books/expenses">All expenses</a>
    </div>
    {saved && <p className="admin-success" role="status">Saved <a className="inline-link" href={`/admin/books/expenses/${saved.id}`}>{saved.number}</a> ({formatPrice(saved.amount_paise)}, {saved.category?.name}). Add the next one.</p>}
    {categories.length === 0
      ? <div className="books-empty"><p>All expense categories are archived. Restore one first.</p><a className="button button-dark" href="/admin/books/expenses/categories">Categories</a></div>
      : <ExpenseForm key={searchParams?.saved ?? "new"} categories={categories} vendors={vendors} today={today} defaults={defaults} cancelHref="/admin/books/expenses" />}
  </>;
}
