import { Plus } from "lucide-react";
import { booksGetPayments, booksGetVendors } from "@/src/lib/books/data";
import { PAYMENT_METHODS } from "@/src/lib/books/payments";
import { formatDate, formatPrice } from "@/src/lib/format";

export default async function PaymentsPage({ searchParams }) {
  const status = searchParams?.status === "voided" ? "voided" : "active";
  const filters = { vendorId: searchParams?.vendor || "", from: searchParams?.from || "", to: searchParams?.to || "", method: PAYMENT_METHODS[searchParams?.method] ? searchParams.method : "" };
  const [payments, vendors] = await Promise.all([booksGetPayments({ status, ...filters }), booksGetVendors({ status: "active" })]);
  const filtered = Object.values(filters).some(Boolean);
  const link = (value) => {
    const params = new URLSearchParams();
    for (const [key, v] of Object.entries({ status: value === "active" ? "" : value, vendor: filters.vendorId, from: filters.from, to: filters.to, method: filters.method })) if (v) params.set(key, v);
    return `/admin/books/payments${params.size ? `?${params}` : ""}`;
  };
  const totalPaise = payments.reduce((sum, payment) => sum + payment.amount_paise, 0);
  const byMethod = Object.keys(PAYMENT_METHODS).map((key) => [key, payments.filter((p) => p.method === key).reduce((sum, p) => sum + p.amount_paise, 0)]).filter(([, paise]) => paise > 0);

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS</p><h1>Payments</h1></div>
      <a className="button button-dark" href="/admin/books/payments/new"><Plus size={14} /> Record payment</a>
    </div>

    <nav className="category-nav admin-tabs" aria-label="Payment status"><ul>
      <li><a href={link("active")} className={status === "active" ? "is-active" : ""} aria-current={status === "active" ? "page" : undefined}>Payments</a></li>
      <li><a href={link("voided")} className={status === "voided" ? "is-active" : ""} aria-current={status === "voided" ? "page" : undefined}>Voided</a></li>
    </ul></nav>

    <form className="admin-filters purchase-filters" action="/admin/books/payments">
      {status !== "active" && <input type="hidden" name="status" value={status} />}
      <label className="field" htmlFor="payf-vendor"><span>Vendor</span>
        <select id="payf-vendor" name="vendor" defaultValue={filters.vendorId}>
          <option value="">All vendors</option>
          {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
        </select>
      </label>
      <label className="field" htmlFor="payf-method"><span>Paid by</span>
        <select id="payf-method" name="method" defaultValue={filters.method}>
          <option value="">Any way</option>
          {Object.entries(PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="field" htmlFor="payf-from"><span>From</span><input id="payf-from" type="date" name="from" defaultValue={filters.from} /></label>
      <label className="field" htmlFor="payf-to"><span>To</span><input id="payf-to" type="date" name="to" defaultValue={filters.to} /></label>
      <button type="submit" className="button button-dark">Filter</button>
      {filtered && <a className="text-link" href={status === "voided" ? "/admin/books/payments?status=voided" : "/admin/books/payments"}>Clear</a>}
    </form>

    {payments.length === 0
      ? <div className="books-empty">
          <p>{filtered ? "No payments match these filters." : status === "voided" ? "No voided payments." : "No payments yet. Record what you pay your vendors and Books keeps each bill's balance — and what you owe — up to date."}</p>
          {!filtered && status === "active" && <a className="button button-dark" href="/admin/books/payments/new"><Plus size={14} /> Record your first payment</a>}
        </div>
      : <>
          {status === "active" && <section className="kpi-row kpi-row-4" aria-label="Payment totals">
            <div className="kpi"><span className="kpi-label">{filtered ? "Total for this filter" : "Total paid"}</span><span className="kpi-value">{formatPrice(totalPaise)}</span><span className="kpi-note">{payments.length} {payments.length === 1 ? "payment" : "payments"}{filters.from || filters.to ? ` · ${filters.from ? formatDate(filters.from) : "start"} to ${filters.to ? formatDate(filters.to) : "today"}` : ""}</span></div>
            {byMethod.slice(0, 3).map(([key, paise]) => <div className="kpi" key={key}><span className="kpi-label">{PAYMENT_METHODS[key]}</span><span className="kpi-value">{formatPrice(paise)}</span></div>)}
          </section>}
          <table className="admin-table table-cards">
            <thead><tr><th>Payment</th><th>Vendor</th><th>Paid by</th><th>Pays for</th><th className="num">Amount</th></tr></thead>
            <tbody>{payments.map((payment) => <tr key={payment.id} className={payment.status === "voided" ? "is-void" : ""}>
              <td data-label="Payment"><a href={`/admin/books/payments/${payment.id}`}><strong>{payment.number}</strong></a><small>{formatDate(payment.paid_on)}</small></td>
              <td data-label="Vendor">{payment.vendor?.name}</td>
              <td data-label="Paid by"><span className="cell-value">{PAYMENT_METHODS[payment.method]}{payment.reference && <small>{payment.reference}</small>}</span></td>
              <td data-label="Pays for"><span className="cell-value">{payment.allocations.map((a) => a.purchase?.number ?? "Opening balance").join(", ") || <span className="muted">—</span>}
                {payment.status === "active" && payment.advancePaise > 0 && <small>{formatPrice(payment.advancePaise)} advance</small>}
                {payment.status === "voided" && <small>Voided: {payment.void_reason}</small>}</span></td>
              <td data-label="Amount" className="num">{formatPrice(payment.amount_paise)}</td>
            </tr>)}</tbody>
          </table>
          {status === "voided" && <p className="admin-note">Voided payments don't count in any balance or total. They stay here for the record.</p>}
        </>}
  </>;
}
