import { notFound } from "next/navigation";
import { refundOrder, restockOrder, updateOrderStatus } from "@/app/admin/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import SubmitButton from "@/components/admin/SubmitButton";
import { adminGetOrder } from "@/src/lib/admin-catalog";
import { isEmailConfigured } from "@/src/lib/email";
import { formatPrice } from "@/src/lib/format";
import { STATUS_LABELS } from "@/src/lib/order-status";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const EDITABLE_STATUSES = ["paid", "shipped", "delivered", "cancelled"];
const SAVED_MESSAGES = { 1: "Order updated.", refunded: "Refund issued through Razorpay.", restocked: "Items returned to stock." };

export default async function AdminOrderPage({ params, searchParams }) {
  const order = await adminGetOrder(params.id);
  if (!order) notFound();
  const editable = EDITABLE_STATUSES.includes(order.status);
  const refundable = editable && order.razorpay_payment_id && !order.refund_id;
  const canRestock = ["cancelled", "refunded"].includes(order.status) && !order.restocked;
  const when = (value) => (value ? dateFormat.format(new Date(value)) : null);

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">ORDER · {STATUS_LABELS[order.status]}</p><h1>{order.order_number}</h1></div>
      <a className="text-link" href="/admin/orders">All orders</a>
    </div>
    {searchParams?.saved && <p className="admin-success" role="status">{SAVED_MESSAGES[searchParams.saved] ?? "Saved."}</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}

    <div className="admin-split">
      <div>
        <table className="admin-table">
          <thead><tr><th>Item</th><th className="num">Price</th><th className="num">Qty</th><th className="num">Total</th></tr></thead>
          <tbody>
            {order.order_items.map((item) => <tr key={item.id}>
              <td><strong>{item.product_name}</strong></td>
              <td className="num">{formatPrice(item.unit_price_paise)}</td>
              <td className="num">{item.quantity}</td>
              <td className="num">{formatPrice(item.unit_price_paise * item.quantity)}</td>
            </tr>)}
            <tr><td colSpan={3}>Delivery ({order.state})</td><td className="num">{order.shipping_paise ? formatPrice(order.shipping_paise) : "Free"}</td></tr>
            <tr><td colSpan={3}><strong>Total</strong></td><td className="num"><strong>{formatPrice(order.total_paise)}</strong></td></tr>
            {order.refund_amount_paise != null && <tr><td colSpan={3}>Refunded</td><td className="num">−{formatPrice(order.refund_amount_paise)}</td></tr>}
          </tbody>
        </table>
        {order.notes && <p className="admin-note"><strong>Customer note:</strong> {order.notes}</p>}

        <dl className="order-timeline">
          <div><dt>Placed</dt><dd>{when(order.created_at)}</dd></div>
          {order.paid_at && <div><dt>Paid</dt><dd>{when(order.paid_at)}{order.razorpay_payment_id && <small>Razorpay {order.razorpay_payment_id}</small>}</dd></div>}
          {order.shipped_at && <div><dt>Shipped</dt><dd>{when(order.shipped_at)}{order.tracking_number && <small>{order.tracking_courier || "Courier"} · {order.tracking_number}</small>}</dd></div>}
          {order.refunded_at && <div><dt>Refunded</dt><dd>{when(order.refunded_at)}<small>Razorpay {order.refund_id}</small></dd></div>}
          {order.restocked && <div><dt>Stock</dt><dd>Items returned to stock</dd></div>}
        </dl>
      </div>

      <aside className="admin-panel">
        <h2 className="eyebrow">SHIP TO</h2>
        <address className="order-address">
          {order.customer_name}<br />{order.address_line1}<br />{order.address_line2 && <>{order.address_line2}<br /></>}{order.city}, {order.state} {order.pincode}
        </address>
        <p className="admin-note"><a href={`tel:+91${order.phone}`}>+91 {order.phone}</a> · <a href={`https://wa.me/91${order.phone}`} target="_blank" rel="noreferrer">WhatsApp</a><br /><a href={`mailto:${order.email}`}>{order.email}</a></p>

        {editable
          ? <form action={updateOrderStatus} className="admin-form order-status-form">
              <input type="hidden" name="id" value={order.id} />
              <label className="field"><span>Status</span>
                <select name="status" defaultValue={order.status}>
                  {EDITABLE_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <fieldset className="order-ship-fields">
                <legend className="admin-note">When marking <strong>Shipped</strong></legend>
                <label className="field"><span>Courier</span><input name="trackingCourier" defaultValue={order.tracking_courier ?? ""} placeholder="e.g. India Post, Delhivery" /></label>
                <label className="field"><span>Tracking number</span><input name="trackingNumber" defaultValue={order.tracking_number ?? ""} /></label>
                {isEmailConfigured && <div className="field-checks"><label><input type="checkbox" name="notify" defaultChecked /> Email the customer</label></div>}
              </fieldset>
              {order.status !== "cancelled" && <div className="field-checks"><label><input type="checkbox" name="restock" defaultChecked /> If cancelling, return items to stock</label></div>}
              <SubmitButton>Update order</SubmitButton>
              <p className="admin-note">Cancelling doesn't refund the customer. Use Refund below.</p>
            </form>
          : order.status === "pending" || order.status === "failed"
            ? <p className="admin-note">This order hasn't been paid, so there's nothing to ship.</p>
            : null}

        {refundable && <form action={refundOrder} className="admin-form order-refund">
          <input type="hidden" name="id" value={order.id} />
          <h2 className="eyebrow">REFUND</h2>
          <p className="admin-note">Refunds the full {formatPrice(order.total_paise)} to the customer's original payment method through Razorpay. For a partial refund, use the Razorpay dashboard.</p>
          <div className="field-checks"><label><input type="checkbox" name="restock" defaultChecked /> Return items to stock</label></div>
          <ConfirmSubmit message={`Refund ${formatPrice(order.total_paise)} for ${order.order_number}? This can't be undone.`}>Refund full amount</ConfirmSubmit>
        </form>}

        {canRestock && <form action={restockOrder} className="order-refund">
          <input type="hidden" name="id" value={order.id} />
          <p className="admin-note">The items from this order haven't been returned to stock.</p>
          <SubmitButton className="admin-danger">Return items to stock</SubmitButton>
        </form>}
      </aside>
    </div>
  </>;
}
