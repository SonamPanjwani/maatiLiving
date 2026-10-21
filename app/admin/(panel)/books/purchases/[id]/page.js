import { notFound } from "next/navigation";
import { IndianRupee, MessageCircle, PackageCheck, Pencil, Printer } from "lucide-react";
import { cancelPurchase, markPurchaseOrdered } from "@/app/admin/(panel)/books/purchases/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import BillFiles from "@/components/books/BillFiles";
import PayStatus from "@/components/books/PayStatus";
import PurchaseStatus from "@/components/books/PurchaseStatus";
import { siteConfig } from "@/src/config/site";
import { booksGetPurchase } from "@/src/lib/books/data";
import { PAYMENT_METHODS } from "@/src/lib/books/payments";
import { PURCHASE_STATUS, purchaseOrderText } from "@/src/lib/books/purchases";
import { formatDate, formatDateTime, formatPrice } from "@/src/lib/format";

const SAVED = {
  created: "Purchase saved as a draft.", ordered: "Purchase saved and marked as ordered.", updated: "Purchase saved.",
  received: "All items received. Stock and cost prices are updated.", partly: "Items received. Stock and cost prices are updated; the rest is still to come.",
  cancelled: "Purchase cancelled.",
};

export default async function PurchasePage({ params, searchParams }) {
  const purchase = await booksGetPurchase(params.id);
  if (!purchase) notFound();
  const { vendor, items } = purchase;
  const cancelled = purchase.status === "cancelled";
  const canReceive = ["draft", "ordered", "partially_received"].includes(purchase.status);
  const qtyOrdered = items.reduce((sum, item) => sum + item.qty_ordered, 0);
  const qtyReceived = items.reduce((sum, item) => sum + item.qty_received, 0);
  const { pay } = purchase;
  const canPay = pay.state && pay.balancePaise > 0 && vendor.status === "active";
  const activePayments = purchase.payments.filter((payment) => payment.status === "active");

  const shareText = (withPrices) => purchaseOrderText(purchase, { withPrices, formatPrice, formatDate, businessName: siteConfig.name ?? "Maati Living" });
  const waLink = (withPrices) => `https://wa.me/${vendor?.whatsapp ? `91${vendor.whatsapp}` : ""}?text=${encodeURIComponent(shareText(withPrices))}`;

  // Receipts: movements written in one receive share a timestamp.
  const receipts = Object.values(purchase.receipts.reduce((groups, move) => {
    (groups[move.created_at] ??= { at: move.created_at, pieces: 0, note: move.note }).pieces += move.qty_change;
    return groups;
  }, {}));

  return <>
    <div className="admin-heading vendor-heading">
      <div>
        <p className="eyebrow">PURCHASE · {PURCHASE_STATUS[purchase.status]?.toUpperCase()}</p>
        <h1>{purchase.number}</h1>
        <p className="admin-note">From <a href={`/admin/books/vendors/${vendor.id}?tab=purchases`}>{vendor.name}</a> · ordered {formatDate(purchase.order_date)}{purchase.expected_date ? ` · expected ${formatDate(purchase.expected_date)}` : ""}</p>
      </div>
      <div className="vendor-actions">
        {canReceive && <a className="button button-dark" href={`/admin/books/purchases/${purchase.id}/receive`}><PackageCheck size={14} /> Receive items</a>}
        {canPay && <a className={canReceive ? "stock-save" : "button button-dark"} href={`/admin/books/payments/new?vendor=${vendor.id}&purchase=${purchase.id}`}><IndianRupee size={14} /> Record payment</a>}
        {!cancelled && <a className="stock-save" href={`/admin/books/purchases/${purchase.id}/edit`}><Pencil size={14} /> {purchase.locked ? "Bill & notes" : "Edit"}</a>}
        {!cancelled && <a className="stock-save" href={waLink(false)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Share PO</a>}
        <a className="stock-save" href={`/admin/books/purchases/${purchase.id}/print`}><Printer size={14} /> Print / PDF</a>
      </div>
    </div>
    {searchParams?.saved && <p className="admin-success" role="status">{SAVED[searchParams.saved] ?? "Saved."}</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}
    {cancelled && <p className="admin-note archived-note">Cancelled {formatDateTime(purchase.cancelled_at)}: {purchase.cancelled_reason}. It stays in your records.</p>}

    <section className="kpi-row kpi-row-4" aria-label="Purchase figures">
      <div className="kpi"><span className="kpi-label">Total</span><span className="kpi-value">{formatPrice(purchase.total_paise)}</span><span className="kpi-note">{items.length} {items.length === 1 ? "product" : "products"}</span></div>
      <div className="kpi"><span className="kpi-label">Received</span><span className="kpi-value">{qtyReceived} / {qtyOrdered}</span><span className="kpi-note">{qtyReceived >= qtyOrdered && qtyOrdered ? "All in stock" : "pieces"}</span></div>
      <div className="kpi"><span className="kpi-label">Vendor's bill</span><span className={`kpi-value ${purchase.bill_number ? "is-text" : ""}`}>{purchase.bill_number || "—"}</span><span className="kpi-note">{purchase.bill_date ? formatDate(purchase.bill_date) : "Not added yet"}</span></div>
      <div className="kpi"><span className="kpi-label">Still to pay</span><span className={`kpi-value ${pay.overdueDays > 0 ? "admin-warn" : ""}`}>{pay.state ? formatPrice(Math.max(pay.balancePaise, 0)) : "—"}</span><span className="kpi-note">{!pay.state ? "Not a bill yet: nothing received, no bill number" : pay.state === "paid" ? "Paid in full" : purchase.due_date ? `Pay by ${formatDate(purchase.due_date)}${pay.overdueDays > 0 ? ` · ${pay.overdueDays} ${pay.overdueDays === 1 ? "day" : "days"} overdue` : ""}` : `${formatPrice(pay.paidPaise)} paid so far`}</span></div>
    </section>

    <div className="admin-split">
      <section>
        <h2 className="eyebrow">ITEMS</h2>
        <table className="admin-table table-cards">
          <thead><tr><th>Product</th><th className="num">Ordered</th><th className="num">Received</th><th className="num">Cost per piece</th><th className="num">Total</th></tr></thead>
          <tbody>
            {items.map((item) => <tr key={item.id}>
              <td data-label="Product"><a href={`/admin/inventory/${item.product_id}`}><strong>{item.product?.name}</strong></a>{item.product?.sku && <small>{item.product.sku}</small>}</td>
              <td data-label="Ordered" className="num">{item.qty_ordered}</td>
              <td data-label="Received" className={`num ${item.qty_received > item.qty_ordered ? "admin-warn" : ""}`}><span className="cell-value">{item.qty_received}{item.qty_received > item.qty_ordered && <small>{item.qty_received - item.qty_ordered} extra</small>}</span></td>
              <td data-label="Cost per piece" className="num"><span className="cell-value">{formatPrice(item.unit_cost_paise)}{item.landed_unit_cost_paise != null && item.landed_unit_cost_paise !== item.unit_cost_paise && <small>{formatPrice(item.landed_unit_cost_paise)} landed</small>}</span></td>
              <td data-label="Total" className="num">{formatPrice(item.line_total_paise)}</td>
            </tr>)}
          </tbody>
        </table>
        <dl className="purchase-totals">
          <div><dt>Items</dt><dd>{formatPrice(purchase.subtotal_paise)}</dd></div>
          {purchase.discount_paise > 0 && <div><dt>Discount</dt><dd>−{formatPrice(purchase.discount_paise)}</dd></div>}
          {purchase.shipping_paise > 0 && <div><dt>Shipping</dt><dd>{formatPrice(purchase.shipping_paise)}</dd></div>}
          {purchase.tax_paise > 0 && <div><dt>Tax</dt><dd>{formatPrice(purchase.tax_paise)}</dd></div>}
          <div className="purchase-total"><dt>Total</dt><dd>{formatPrice(purchase.total_paise)}</dd></div>
        </dl>
        {(purchase.shipping_paise > 0 || purchase.discount_paise > 0) && <p className="admin-note">"Landed" cost per piece includes its share of shipping and discount — that's what goes into the product's cost price.</p>}

        <h2 className="eyebrow books-side-block">TIMELINE</h2>
        <dl className="order-timeline">
          <div><dt>Created</dt><dd>{formatDateTime(purchase.created_at)}</dd></div>
          {purchase.ordered_at && <div><dt>Ordered</dt><dd>{formatDateTime(purchase.ordered_at)}</dd></div>}
          {receipts.map((receipt) => <div key={receipt.at}><dt>Received</dt><dd>{formatDateTime(receipt.at)}<small>{receipt.pieces} {receipt.pieces === 1 ? "piece" : "pieces"} into stock{receipt.note && !receipt.note.startsWith("Received on") ? ` · ${receipt.note}` : ""}</small></dd></div>)}
          {purchase.received_at && <div><dt>Complete</dt><dd>{formatDateTime(purchase.received_at)}<small>Everything ordered has arrived</small></dd></div>}
          {cancelled && <div><dt>Cancelled</dt><dd>{formatDateTime(purchase.cancelled_at)}<small>{purchase.cancelled_reason}</small></dd></div>}
          {activePayments.map((payment) => <div key={payment.id}><dt>Paid</dt><dd><a className="inline-link" href={`/admin/books/payments/${payment.id}`}>{payment.number}</a> · {formatDate(payment.paid_on)}<small>{formatPrice(payment.allocatedPaise)} by {PAYMENT_METHODS[payment.method]}{payment.reference ? ` · ${payment.reference}` : ""}</small></dd></div>)}
          {pay.state === "paid" && <div><dt>Settled</dt><dd>Paid in full</dd></div>}
          {!cancelled && pay.state && pay.state !== "paid" && <div><dt>To pay</dt><dd><PayStatus pay={pay} /></dd></div>}
        </dl>
        {purchase.notes && <><h2 className="eyebrow books-side-block">NOTES</h2><p className="purchase-notes">{purchase.notes}</p></>}
      </section>

      <aside className="admin-panel books-side">
        <h2 className="eyebrow">BILL FILES</h2>
        {purchase.bill_attachments?.length
          ? <BillFiles files={purchase.bill_attachments} />
          : <p className="admin-note">No bill attached yet.{!cancelled && <> <a href={`/admin/books/purchases/${purchase.id}/edit`}>Add a photo or PDF</a>.</>}</p>}

        {!cancelled && <div className="books-side-block">
          <h2 className="eyebrow">SHARE WITH VENDOR</h2>
          <p className="admin-note">Opens WhatsApp{vendor.whatsapp ? ` to +91 ${vendor.whatsapp}` : ""} with the order. Internal notes are never included.</p>
          <p className="share-links"><a className="text-link" href={waLink(false)} target="_blank" rel="noreferrer">Quantities only</a><a className="text-link" href={waLink(true)} target="_blank" rel="noreferrer">With prices</a></p>
        </div>}

        {purchase.status === "draft" && <form action={markPurchaseOrdered} className="admin-form books-side-block">
          <input type="hidden" name="id" value={purchase.id} />
          <h2 className="eyebrow">PLACED THE ORDER?</h2>
          <p className="admin-note">Mark it as ordered once you've sent it to {vendor.name}.</p>
          <ConfirmSubmit className="button button-dark" message={`Mark ${purchase.number} as ordered from ${vendor.name}?`}>Mark as ordered</ConfirmSubmit>
        </form>}

        {purchase.editable && activePayments.length > 0 && <p className="admin-note books-side-block">Payments are linked to this purchase, so it can't be cancelled. To cancel it, first void those payments or move them to another bill.</p>}
        {purchase.editable && activePayments.length === 0 && <form action={cancelPurchase} className="admin-form books-side-block">
          <input type="hidden" name="id" value={purchase.id} />
          <h2 className="eyebrow">CANCEL PURCHASE</h2>
          <p className="admin-note">Purchases are never deleted. A cancelled one stays in your records, crossed out, with the reason.</p>
          <label className="field" htmlFor="cancel-reason"><span>Reason</span><input id="cancel-reason" name="reason" required minLength={3} maxLength={300} placeholder="e.g. vendor out of stock" /></label>
          <ConfirmSubmit message={`Cancel ${purchase.number} (${formatPrice(purchase.total_paise)} from ${vendor.name})? This can't be undone.`}>Cancel purchase</ConfirmSubmit>
        </form>}
        {purchase.payments.some((payment) => payment.status === "voided") && <p className="admin-note books-side-block">Voided payments: {purchase.payments.filter((payment) => payment.status === "voided").map((payment, index) => <span key={payment.id}>{index > 0 && ", "}<a href={`/admin/books/payments/${payment.id}`} className="inline-link is-void-link">{payment.number}</a></span>)}. They don't count towards what's paid.</p>}
        {purchase.locked && !cancelled && <p className="admin-note books-side-block">Stock has been received, so this purchase can't be cancelled or have its items changed. Fix stock with Adjust stock on the product, and note why under Bill & notes.</p>}
      </aside>
    </div>
  </>;
}
