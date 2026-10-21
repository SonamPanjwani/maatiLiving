import { ChevronLeft, ChevronRight, Plus, Settings2 } from "lucide-react";
import RecurringDue from "@/components/books/RecurringDue";
import { booksGetExpenseCategories, booksGetExpenses, booksGetRecurringDue } from "@/src/lib/books/data";
import { PAID_VIA, categoryTotals, monthRange } from "@/src/lib/books/expenses";
import { formatDate, formatPrice, todayInIndia } from "@/src/lib/format";

const SAVED = { skipped: "Skipped. The reminder moved to the next date." };

export default async function ExpensesPage({ searchParams }) {
  const today = todayInIndia();
  const range = monthRange(searchParams?.month) ?? monthRange(today.slice(0, 7));
  const status = searchParams?.status === "voided" ? "voided" : "active";
  const categoryId = searchParams?.category || "";
  const [expenses, categories, due] = await Promise.all([
    booksGetExpenses({ from: range.from, to: range.to, categoryId, status }),
    booksGetExpenseCategories(),
    booksGetRecurringDue(),
  ]);
  const link = (params) => {
    const merged = { month: range.month, category: categoryId, status: status === "voided" ? "voided" : "", ...params };
    const query = new URLSearchParams(Object.entries(merged).filter(([, v]) => v));
    return `/admin/books/expenses?${query}`;
  };
  const totals = categoryTotals(expenses);
  const totalPaise = totals.reduce((sum, row) => sum + row.totalPaise, 0);
  const isFuture = range.next > today.slice(0, 7);

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS</p><h1>Expenses</h1></div>
      <div className="vendor-actions">
        <a className="stock-save" href="/admin/books/expenses/categories"><Settings2 size={14} /> Categories</a>
        <a className="button button-dark" href="/admin/books/expenses/new"><Plus size={14} /> Add expense</a>
      </div>
    </div>
    {searchParams?.saved && <p className="admin-success" role="status">{SAVED[searchParams.saved] ?? "Saved."}</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}

    {due.length > 0 && <section className="books-due" aria-label="Repeating expenses due">
      <h2 className="eyebrow">DUE TO PAY <small>repeating expenses, next 7 days</small></h2>
      <RecurringDue items={due} />
    </section>}

    <nav className="month-switcher" aria-label="Month">
      <a className="stock-save" href={link({ month: range.prev })} aria-label={`Previous month, ${monthRange(range.prev).label}`}><ChevronLeft size={16} /></a>
      <strong>{range.label}</strong>
      {isFuture ? <span className="stock-save is-disabled" aria-hidden="true"><ChevronRight size={16} /></span>
        : <a className="stock-save" href={link({ month: range.next })} aria-label={`Next month, ${monthRange(range.next).label}`}><ChevronRight size={16} /></a>}
      {range.month !== today.slice(0, 7) && <a className="text-link" href={link({ month: today.slice(0, 7) })}>This month</a>}
    </nav>

    <nav className="category-nav admin-tabs" aria-label="Expense filters"><ul>
      <li><a href={link({ status: "" })} className={status === "active" ? "is-active" : ""} aria-current={status === "active" ? "page" : undefined}>Expenses</a></li>
      <li><a href={link({ status: "voided" })} className={status === "voided" ? "is-active" : ""} aria-current={status === "voided" ? "page" : undefined}>Voided</a></li>
    </ul></nav>

    <form className="admin-filters" action="/admin/books/expenses">
      <input type="hidden" name="month" value={range.month} />
      {status === "voided" && <input type="hidden" name="status" value="voided" />}
      <label className="field" htmlFor="exf-cat"><span>Category</span>
        <select id="exf-cat" name="category" defaultValue={categoryId}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.status === "archived" ? " (archived)" : ""}</option>)}
        </select>
      </label>
      <button type="submit" className="button button-dark">Filter</button>
      {categoryId && <a className="text-link" href={link({ category: "" })}>Clear</a>}
    </form>

    {expenses.length === 0
      ? <div className="books-empty">
          <p>{status === "voided" ? `No voided expenses in ${range.label}.` : categoryId ? `Nothing in this category in ${range.label}.` : `No expenses in ${range.label}. Add packaging, courier, ads, rent — everything that isn't stock — so your profit is real.`}</p>
          {status === "active" && !categoryId && <a className="button button-dark" href="/admin/books/expenses/new"><Plus size={14} /> Add an expense</a>}
        </div>
      : <div className="admin-split">
          <section>
            <table className="admin-table table-cards">
              <thead><tr><th>Expense</th><th>Category</th><th>Paid by</th><th className="num">Amount</th></tr></thead>
              <tbody>{expenses.map((expense) => <tr key={expense.id} className={expense.status === "voided" ? "is-void" : ""}>
                <td data-label="Expense"><span className="cell-value"><a href={`/admin/books/expenses/${expense.id}`}><strong>{expense.description || expense.category?.name}</strong></a>
                  <small>{formatDate(expense.spent_on)} · {expense.number}{expense.vendor ? ` · ${expense.vendor.name}` : ""}{expense.is_recurring ? " · repeats" : ""}</small>
                  {expense.status === "voided" && <small>Voided: {expense.void_reason}</small>}</span></td>
                <td data-label="Category">{expense.category?.name}</td>
                <td data-label="Paid by"><span className="cell-value">{PAID_VIA[expense.paid_via]}{expense.attachments?.length > 0 && <small>receipt attached</small>}</span></td>
                <td data-label="Amount" className="num">{formatPrice(expense.amount_paise)}</td>
              </tr>)}</tbody>
            </table>
          </section>
          {status === "active" && <aside className="admin-panel books-side">
            <h2 className="eyebrow">{range.label.toUpperCase()}</h2>
            <p className="kpi-value">{formatPrice(totalPaise)}</p>
            <p className="admin-note">{expenses.length} {expenses.length === 1 ? "expense" : "expenses"}{categoryId ? " in this category" : ""}</p>
            <dl className="purchase-totals category-totals">
              {totals.map((row) => <div key={row.categoryId}><dt><a className="inline-link" href={link({ category: row.categoryId })}>{row.name}</a> <small>{row.count}</small></dt><dd>{formatPrice(row.totalPaise)}</dd></div>)}
              <div className="purchase-total"><dt>Total</dt><dd>{formatPrice(totalPaise)}</dd></div>
            </dl>
          </aside>}
        </div>}
  </>;
}
