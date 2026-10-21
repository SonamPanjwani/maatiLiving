import { Plus } from "lucide-react";
import PayStatus from "@/components/books/PayStatus";
import PurchaseStatus from "@/components/books/PurchaseStatus";
import { PAY_FILTERS, PURCHASE_STATUSES, booksGetPurchaseCounts, booksGetPurchases, booksGetVendors } from "@/src/lib/books/data";
import { PURCHASE_STATUS } from "@/src/lib/books/purchases";
import { formatDate, formatPrice } from "@/src/lib/format";

export default async function PurchasesPage({ searchParams }) {
  const status = PURCHASE_STATUSES.includes(searchParams?.status) ? searchParams.status : "all";
  const filters = { vendorId: searchParams?.vendor || "", from: searchParams?.from || "", to: searchParams?.to || "", q: searchParams?.q || "", pay: PAY_FILTERS.includes(searchParams?.pay) ? searchParams.pay : "" };
  const [purchases, counts, vendors] = await Promise.all([
    booksGetPurchases({ status, ...filters }),
    booksGetPurchaseCounts(),
    booksGetVendors({ status: "active" }),
  ]);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const filtered = Object.values(filters).some(Boolean);
  const tab = (value) => {
    const params = new URLSearchParams();
    for (const [key, v] of Object.entries({ status: value === "all" ? "" : value, q: filters.q, vendor: filters.vendorId, from: filters.from, to: filters.to, pay: filters.pay })) if (v) params.set(key, v);
    const query = params.toString();
    return `/admin/books/purchases${query ? `?${query}` : ""}`;
  };
  const shownTotal = purchases.filter((p) => p.status !== "cancelled").reduce((sum, p) => sum + p.total_paise, 0);

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS</p><h1>Purchases</h1></div>
      <a className="button button-dark" href="/admin/books/purchases/new"><Plus size={14} /> New purchase</a>
    </div>
    {searchParams?.saved === "cancelled" && <p className="admin-success" role="status">Purchase cancelled.</p>}

    <nav className="category-nav admin-tabs" aria-label="Purchase status"><ul>
      {[["all", "All", total], ...PURCHASE_STATUSES.map((key) => [key, PURCHASE_STATUS[key], counts[key] ?? 0])].map(([key, label, n]) =>
        <li key={key}><a href={tab(key)} className={status === key ? "is-active" : ""} aria-current={status === key ? "page" : undefined}>{label} <small>{n}</small></a></li>)}
    </ul></nav>

    <form className="admin-filters purchase-filters" action="/admin/books/purchases">
      {status !== "all" && <input type="hidden" name="status" value={status} />}
      <label className="field" htmlFor="pf-q"><span>PO or bill number</span><input id="pf-q" type="search" name="q" defaultValue={filters.q} placeholder="PO-1001" enterKeyHint="search" /></label>
      <label className="field" htmlFor="pf-vendor"><span>Vendor</span>
        <select id="pf-vendor" name="vendor" defaultValue={filters.vendorId}>
          <option value="">All vendors</option>
          {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
        </select>
      </label>
      <label className="field" htmlFor="pf-pay"><span>Payment</span>
        <select id="pf-pay" name="pay" defaultValue={filters.pay}>
          <option value="">Any</option>
          <option value="unpaid">Still to pay</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid in full</option>
        </select>
      </label>
      <label className="field" htmlFor="pf-from"><span>From</span><input id="pf-from" type="date" name="from" defaultValue={filters.from} /></label>
      <label className="field" htmlFor="pf-to"><span>To</span><input id="pf-to" type="date" name="to" defaultValue={filters.to} /></label>
      <button type="submit" className="button button-dark">Filter</button>
      {filtered && <a className="text-link" href={`/admin/books/purchases${status !== "all" ? `?status=${status}` : ""}`}>Clear</a>}
    </form>

    {purchases.length === 0
      ? <div className="books-empty">
          <p>{total === 0 ? "No purchases yet. Record what you order from your potters and shell artisans — receiving it adds the stock and keeps your cost prices right." : filtered ? "No purchases match these filters." : `No ${PURCHASE_STATUS[status]?.toLowerCase() ?? ""} purchases.`}</p>
          {total === 0 && <a className="button button-dark" href="/admin/books/purchases/new"><Plus size={14} /> Record your first purchase</a>}
        </div>
      : <>
          <table className="admin-table table-cards">
            <thead><tr><th>Purchase</th><th>Vendor</th><th>Status</th><th>Paid</th><th className="num">Received</th><th className="num">Total</th></tr></thead>
            <tbody>{purchases.map((purchase) => <tr key={purchase.id} className={purchase.status === "cancelled" ? "is-void" : ""}>
              <td data-label="Purchase"><a href={`/admin/books/purchases/${purchase.id}`}><strong>{purchase.number}</strong></a><small>{formatDate(purchase.order_date)}{purchase.bill_number ? ` · bill ${purchase.bill_number}` : ""}</small></td>
              <td data-label="Vendor">{purchase.vendor?.name}</td>
              <td data-label="Status"><PurchaseStatus status={purchase.status} /></td>
              <td data-label="Paid"><PayStatus pay={purchase.pay} /></td>
              <td data-label="Received" className="num">{purchase.qtyReceived} / {purchase.qtyOrdered}</td>
              <td data-label="Total" className="num"><span className="cell-value">{formatPrice(purchase.total_paise)}{purchase.due_date && purchase.status !== "cancelled" && <small>pay by {formatDate(purchase.due_date)}</small>}</span></td>
            </tr>)}</tbody>
          </table>
          <p className="admin-note">{purchases.length} {purchases.length === 1 ? "purchase" : "purchases"} · {formatPrice(shownTotal)} (not counting cancelled){purchases.some((p) => p.pay.balancePaise > 0) ? ` · ${formatPrice(purchases.reduce((sum, p) => sum + Math.max(p.pay.balancePaise, 0), 0))} still to pay` : ""}.</p>
        </>}
  </>;
}
