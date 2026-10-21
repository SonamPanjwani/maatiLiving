import { skipRecurring } from "@/app/admin/(panel)/books/expenses/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { RECURRENCE } from "@/src/lib/books/expenses";
import { formatDate, formatPrice } from "@/src/lib/format";

// Repeating expenses that are due (or overdue): confirm as paid (opens the form with the amount filled in) or skip.
// back: "dashboard" | "expenses" — where Skip returns to.
export default function RecurringDue({ items, back = "expenses" }) {
  if (!items.length) return null;
  return <table className="admin-table table-cards recurring-due">
    <thead><tr><th>Expense</th><th>Due</th><th className="num">Last amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{items.map((item) => <tr key={item.id}>
      <td data-label="Expense"><span className="cell-value"><a href={`/admin/books/expenses/${item.id}`}><strong>{item.description || item.category?.name}</strong></a>
        <small>{item.category?.name} · {RECURRENCE[item.recurrence]?.toLowerCase()}</small></span></td>
      <td data-label="Due"><span className={`cell-value ${item.overdue ? "admin-warn" : ""}`}>{formatDate(item.next_due_on)}{item.overdue && <small>overdue</small>}</span></td>
      <td data-label="Last amount" className="num">{formatPrice(item.amount_paise)}</td>
      <td className="table-action recurring-actions">
        <a className="stock-save" href={`/admin/books/expenses/${item.id}/confirm?due=${item.next_due_on}`}>Confirm paid</a>
        <form action={skipRecurring}>
          <input type="hidden" name="id" value={item.id} /><input type="hidden" name="dueOn" value={item.next_due_on} /><input type="hidden" name="back" value={back} />
          <ConfirmSubmit className="text-link" message={`Skip ${item.description || item.category?.name} due ${formatDate(item.next_due_on)}? Nothing is added; the reminder moves to the next date.`}>Skip</ConfirmSubmit>
        </form>
      </td>
    </tr>)}</tbody>
  </table>;
}
