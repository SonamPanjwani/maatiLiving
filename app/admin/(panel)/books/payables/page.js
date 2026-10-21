import { Plus } from "lucide-react";
import { booksGetPayables } from "@/src/lib/books/data";
import { formatDate, formatPrice } from "@/src/lib/format";

export default async function PayablesPage() {
  const payables = await booksGetPayables();
  const { bills, owing, unallocated } = payables;

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS</p><h1>Payables</h1></div>
      <a className="button button-dark" href="/admin/books/payments/new"><Plus size={14} /> Record payment</a>
    </div>

    <section className="kpi-row kpi-row-4" aria-label="What you owe">
      <div className="kpi"><span className="kpi-label">Total due</span><span className="kpi-value">{formatPrice(payables.totalDuePaise)}</span><span className="kpi-note">to {owing.length} {owing.length === 1 ? "vendor" : "vendors"}</span></div>
      <div className="kpi"><span className="kpi-label">Overdue</span><span className={`kpi-value ${payables.overdueCount ? "admin-warn" : ""}`}>{formatPrice(payables.overduePaise)}</span><span className="kpi-note">{payables.overdueCount} {payables.overdueCount === 1 ? "bill" : "bills"} past the pay-by date</span></div>
      <div className="kpi"><span className="kpi-label">Due in 7 days</span><span className="kpi-value">{formatPrice(payables.dueSoon.reduce((sum, bill) => sum + bill.balancePaise, 0))}</span><span className="kpi-note">{payables.dueSoon.length} {payables.dueSoon.length === 1 ? "bill" : "bills"}</span></div>
      <div className="kpi"><span className="kpi-label">Advances with vendors</span><span className="kpi-value">{formatPrice(payables.advancePaise)}</span><span className="kpi-note">Paid ahead of bills</span></div>
    </section>

    {unallocated.length > 0 && <div className="admin-note payables-advance" role="note">
      <p><strong>Payments not linked to a bill:</strong></p>
      <ul>{unallocated.map(({ payment, unallocatedPaise, vendorName }) => <li key={payment.id}>
        <a className="inline-link" href={`/admin/books/payments/${payment.id}`}>{payment.number}</a> to {vendorName} — {formatPrice(unallocatedPaise)} unallocated. Open it to apply it to a bill.
      </li>)}</ul>
    </div>}

    {bills.length === 0
      ? <div className="books-empty"><p>Nothing to pay. Bills show up here once goods arrive or the vendor's bill number is added to a purchase.</p></div>
      : <>
          <h2 className="eyebrow books-side-block">OPEN BILLS <small>most overdue first</small></h2>
          <table className="admin-table table-cards">
            <thead><tr><th>Bill</th><th>Vendor</th><th>Pay by</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Still to pay</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{bills.map((bill) => <tr key={`${bill.vendor.id}-${bill.key}`}>
              <td data-label="Bill"><span className="cell-value">{bill.purchaseId ? <a href={`/admin/books/purchases/${bill.purchaseId}`}><strong>{bill.label}</strong></a> : <strong>{bill.label}</strong>}
                {bill.purchaseId && <small>{[bill.billNumber && `Bill ${bill.billNumber}`, bill.date && formatDate(bill.date)].filter(Boolean).join(" · ")}</small>}</span></td>
              <td data-label="Vendor"><a href={`/admin/books/vendors/${bill.vendor.id}?tab=statement`}>{bill.vendor.name}</a></td>
              <td data-label="Pay by">{bill.dueDate
                ? <span className="cell-value">{formatDate(bill.dueDate)}{bill.overdueDays > 0 && <small className="admin-warn">{bill.overdueDays} {bill.overdueDays === 1 ? "day" : "days"} overdue</small>}</span>
                : <span className="muted">No date</span>}</td>
              <td data-label="Total" className="num">{formatPrice(bill.totalPaise)}</td>
              <td data-label="Paid" className="num">{bill.paidPaise ? formatPrice(bill.paidPaise) : <span className="muted">—</span>}</td>
              <td data-label="Still to pay" className={`num ${bill.overdueDays > 0 ? "admin-warn" : ""}`}><strong>{formatPrice(bill.balancePaise)}</strong></td>
              <td className="table-action"><a className="text-link" href={`/admin/books/payments/new?vendor=${bill.vendor.id}${bill.purchaseId ? `&purchase=${bill.purchaseId}` : ""}`}>Pay<span className="sr-only"> {bill.label} to {bill.vendor.name}</span></a></td>
            </tr>)}</tbody>
          </table>
          <p className="admin-note">A bill counts once its goods arrive or its bill number is added. "Pay by" is the bill date plus the vendor's payment terms.</p>
        </>}
  </>;
}
