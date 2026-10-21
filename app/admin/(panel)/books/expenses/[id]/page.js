import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { stopRecurring, voidExpense } from "@/app/admin/(panel)/books/expenses/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import BillFiles from "@/components/books/BillFiles";
import { booksGetExpense } from "@/src/lib/books/data";
import { PAID_VIA, RECURRENCE, dueState } from "@/src/lib/books/expenses";
import { formatDate, formatDateTime, formatPrice, todayInIndia } from "@/src/lib/format";

const SAVED = {
  added: "Expense saved.", updated: "Expense saved.", voided: "Expense voided. It no longer counts in any total.",
  confirmed: "Paid and added. The reminder moved to the next date.", stopped: "It won't repeat any more.",
};

export default async function ExpensePage({ params, searchParams }) {
  const expense = await booksGetExpense(params.id);
  if (!expense) notFound();
  const voided = expense.status === "voided";
  const today = todayInIndia();
  const due = expense.is_recurring ? dueState(expense.next_due_on, today) : null;

  return <>
    <div className="admin-heading vendor-heading">
      <div>
        <p className="eyebrow">EXPENSE · {expense.number}{voided ? " · VOIDED" : ""}</p>
        <h1>{expense.description || expense.category?.name}</h1>
        <p className="admin-note">{expense.category?.name} · {formatDate(expense.spent_on)} · {PAID_VIA[expense.paid_via]}{expense.vendor ? <> · <a className="inline-link" href={`/admin/books/vendors/${expense.vendor.id}`}>{expense.vendor.name}</a></> : ""}</p>
      </div>
      {!voided && <div className="vendor-actions">
        <a className="stock-save" href={`/admin/books/expenses/${expense.id}/edit`}><Pencil size={14} /> Edit</a>
      </div>}
    </div>
    {searchParams?.saved && <p className="admin-success" role="status">{SAVED[searchParams.saved] ?? "Saved."}</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}
    {voided && <p className="admin-note archived-note">Voided {formatDateTime(expense.voided_at)}: {expense.void_reason}. It stays in your records but doesn't count anywhere.</p>}

    <section className="kpi-row kpi-row-4" aria-label="Expense figures">
      <div className="kpi"><span className="kpi-label">Amount</span><span className={`kpi-value ${voided ? "is-void" : ""}`}>{formatPrice(expense.amount_paise)}</span><span className="kpi-note">{expense.tax_paise ? `incl. ${formatPrice(expense.tax_paise)} GST` : "Tax not entered"}</span></div>
      <div className="kpi"><span className="kpi-label">Date</span><span className="kpi-value is-text">{formatDate(expense.spent_on)}</span><span className="kpi-note">{PAID_VIA[expense.paid_via]}</span></div>
      <div className="kpi"><span className="kpi-label">Category</span><span className="kpi-value is-text">{expense.category?.name}</span><span className="kpi-note"><a className="inline-link" href={`/admin/books/expenses?month=${expense.spent_on.slice(0, 7)}&category=${expense.category_id}`}>Same month, same category</a></span></div>
      <div className="kpi"><span className="kpi-label">Repeats</span><span className="kpi-value is-text">{expense.is_recurring ? RECURRENCE[expense.recurrence] : expense.source ? "Repeat payment" : "No"}</span>
        <span className={`kpi-note ${due === "overdue" ? "admin-warn" : ""}`}>{expense.is_recurring ? `Next due ${formatDate(expense.next_due_on)}${due === "overdue" ? " · overdue" : ""}` : expense.source ? <>from <a className="inline-link" href={`/admin/books/expenses/${expense.source.id}`}>{expense.source.number}</a></> : "One-off"}</span></div>
    </section>

    <div className="admin-split">
      <section>
        <h2 className="eyebrow">RECEIPT</h2>
        {expense.attachments?.length ? <BillFiles files={expense.attachments} /> : <p className="admin-note">No receipt attached.{!voided && <> <a className="inline-link" href={`/admin/books/expenses/${expense.id}/edit`}>Add a photo</a>.</>}</p>}

        {expense.occurrences.length > 0 && <>
          <h2 className="eyebrow books-side-block">PAID SO FAR</h2>
          <table className="admin-table table-cards">
            <thead><tr><th>Expense</th><th>Date</th><th className="num">Amount</th></tr></thead>
            <tbody>{expense.occurrences.map((row) => <tr key={row.id} className={row.status === "voided" ? "is-void" : ""}>
              <td data-label="Expense"><a href={`/admin/books/expenses/${row.id}`}><strong>{row.number}</strong></a></td>
              <td data-label="Date">{formatDate(row.spent_on)}</td>
              <td data-label="Amount" className="num">{formatPrice(row.amount_paise)}</td>
            </tr>)}</tbody>
          </table>
        </>}
        <p className="admin-note books-side-block">Recorded {formatDateTime(expense.created_at)}.</p>
      </section>

      <aside className="admin-panel books-side">
        {expense.is_recurring && <div className="books-side-block">
          <h2 className="eyebrow">NEXT PAYMENT</h2>
          <p className="admin-note">Due {formatDate(expense.next_due_on)}. You'll see a reminder on the dashboard a week before.</p>
          {due !== "upcoming" && <a className="button button-dark" href={`/admin/books/expenses/${expense.id}/confirm?due=${expense.next_due_on}`}>Confirm paid</a>}
          <form action={stopRecurring} className="admin-form">
            <input type="hidden" name="id" value={expense.id} />
            <ConfirmSubmit className="text-link" message={`Stop repeating ${expense.description || expense.category?.name}? This expense and the ones already paid stay as they are.`}>Stop repeating</ConfirmSubmit>
          </form>
        </div>}

        {!voided && <form action={voidExpense} className="admin-form books-side-block">
          <input type="hidden" name="id" value={expense.id} />
          <h2 className="eyebrow">VOID EXPENSE</h2>
          <p className="admin-note">Expenses are never deleted. Voiding takes it out of every total and keeps it here, crossed out, with the reason.{expense.is_recurring ? " It also stops the repeat." : ""}</p>
          <label className="field" htmlFor="void-reason"><span>Reason</span><input id="void-reason" name="reason" required minLength={3} maxLength={300} placeholder="e.g. entered twice" /></label>
          <ConfirmSubmit message={`Void ${expense.number} (${formatPrice(expense.amount_paise)}, ${expense.category?.name})? This can't be undone.`}>Void expense</ConfirmSubmit>
        </form>}
      </aside>
    </div>
  </>;
}
