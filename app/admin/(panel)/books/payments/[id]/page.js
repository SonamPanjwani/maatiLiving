import { notFound } from "next/navigation";
import { voidPayment } from "@/app/admin/(panel)/books/payments/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import BillFiles from "@/components/books/BillFiles";
import PaymentAllocationForm from "@/components/books/PaymentAllocationForm";
import { booksGetPayment } from "@/src/lib/books/data";
import { PAYMENT_METHODS } from "@/src/lib/books/payments";
import { formatDate, formatDateTime, formatPrice, todayInIndia } from "@/src/lib/format";

const SAVED = {
  recorded: "Payment recorded. The bills and the vendor's balance are updated.",
  allocated: "Allocation saved.",
  voided: "Payment voided. It no longer counts in any balance.",
};

export default async function PaymentPage({ params, searchParams }) {
  const payment = await booksGetPayment(params.id);
  if (!payment) notFound();
  const { vendor } = payment;
  const voided = payment.status === "voided";

  return <>
    <div className="admin-heading vendor-heading">
      <div>
        <p className="eyebrow">PAYMENT{voided ? " · VOIDED" : ""}</p>
        <h1>{payment.number}</h1>
        <p className="admin-note">To <a className="inline-link" href={`/admin/books/vendors/${vendor.id}?tab=payments`}>{vendor.name}</a> · paid {formatDate(payment.paid_on)} by {PAYMENT_METHODS[payment.method]}{payment.reference ? ` · ${payment.reference}` : ""}</p>
      </div>
    </div>
    {searchParams?.saved && <p className="admin-success" role="status">{SAVED[searchParams.saved] ?? "Saved."}</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}
    {voided && <p className="admin-note archived-note">Voided {formatDateTime(payment.voided_at)}: {payment.void_reason}. It stays in your records but doesn't count anywhere.</p>}

    <section className="kpi-row kpi-row-4" aria-label="Payment figures">
      <div className="kpi"><span className="kpi-label">Amount</span><span className={`kpi-value ${voided ? "is-void" : ""}`}>{formatPrice(payment.amount_paise)}</span><span className="kpi-note">{formatDate(payment.paid_on)}</span></div>
      <div className="kpi"><span className="kpi-label">Pays for bills</span><span className="kpi-value">{formatPrice(payment.allocatedPaise)}</span><span className="kpi-note">{payment.allocations.length} {payment.allocations.length === 1 ? "item" : "items"}</span></div>
      <div className="kpi"><span className="kpi-label">Advance</span><span className="kpi-value">{formatPrice(payment.advancePaise)}</span><span className="kpi-note">{payment.advancePaise > 0 && !voided ? "Not linked to a bill yet" : "Nothing left over"}</span></div>
      <div className="kpi"><span className="kpi-label">Paid by</span><span className="kpi-value is-text">{PAYMENT_METHODS[payment.method]}</span><span className="kpi-note">{payment.reference || "No reference"}</span></div>
    </section>

    <div className="admin-split">
      <section>
        <h2 className="eyebrow">{voided ? "WHAT IT PAID FOR" : "PAYS FOR"}</h2>
        {payment.allocations.length === 0
          ? <p className="admin-note">Not linked to any bill — the whole amount is an advance.</p>
          : <table className="admin-table table-cards">
              <thead><tr><th>Bill</th><th>Pay by</th><th className="num">Bill total</th><th className="num">From this payment</th></tr></thead>
              <tbody>{payment.allocations.map((a) => <tr key={a.id}>
                <td data-label="Bill">{a.purchase
                  ? <span className="cell-value"><a href={`/admin/books/purchases/${a.purchase.id}`}><strong>{a.purchase.number}</strong></a>{a.purchase.bill_number && <small>Bill {a.purchase.bill_number}</small>}</span>
                  : <strong>Opening balance</strong>}</td>
                <td data-label="Pay by">{a.purchase?.due_date ? formatDate(a.purchase.due_date) : <span className="muted">—</span>}</td>
                <td data-label="Bill total" className="num">{formatPrice(a.purchase?.total_paise ?? vendor.opening_balance_paise)}</td>
                <td data-label="From this payment" className="num">{formatPrice(a.amount_paise)}</td>
              </tr>)}</tbody>
            </table>}

        {!voided && <>
          <h2 className="eyebrow books-side-block">CHANGE ALLOCATION</h2>
          <p className="admin-note">Move this payment to other bills, or apply its advance to a bill that came later. Amounts already paid by other payments aren't affected.</p>
          <PaymentAllocationForm payment={payment} items={payment.openItems} today={todayInIndia()} />
        </>}

        {payment.notes && <><h2 className="eyebrow books-side-block">NOTES</h2><p className="purchase-notes">{payment.notes}</p></>}
        <p className="admin-note books-side-block">Recorded {formatDateTime(payment.created_at)}.</p>
      </section>

      <aside className="admin-panel books-side">
        <h2 className="eyebrow">PROOF</h2>
        {payment.attachments?.length ? <BillFiles files={payment.attachments} /> : <p className="admin-note">No screenshot or receipt attached.</p>}

        {!voided && <form action={voidPayment} className="admin-form books-side-block">
          <input type="hidden" name="id" value={payment.id} />
          <h2 className="eyebrow">VOID PAYMENT</h2>
          <p className="admin-note">Payments are never deleted or edited. Voiding takes it out of every balance and keeps it here, crossed out, with the reason. Record the right one again after.</p>
          <label className="field" htmlFor="void-reason"><span>Reason</span><input id="void-reason" name="reason" required minLength={3} maxLength={300} placeholder="e.g. entered twice" /></label>
          <ConfirmSubmit message={`Void ${payment.number} (${formatPrice(payment.amount_paise)} to ${vendor.name})? The bills it paid go back to unpaid. This can't be undone.`}>Void payment</ConfirmSubmit>
        </form>}
      </aside>
    </div>
  </>;
}
