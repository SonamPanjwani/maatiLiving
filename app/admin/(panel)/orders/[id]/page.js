import { notFound } from "next/navigation";
import { updateOrderStatus } from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { adminGetOrder } from "@/src/lib/admin-catalog";
import { formatPrice } from "@/src/lib/format";
import { STATUS_LABELS } from "@/src/lib/order-status";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const PAID_STATUSES = ["paid", "shipped", "delivered", "cancelled"];

export default async function AdminOrderPage({ params, searchParams }) {
  const order = await adminGetOrder(params.id);
  if (!order) notFound();
  const isPaid = PAID_STATUSES.includes(order.status);
  const whatsapp = `https://wa.me/91${order.phone}`;

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">ORDER · {STATUS_LABELS[order.status]}</p><h1>{order.order_number}</h1></div>
      <a className="text-link" href="/admin/orders">All orders</a>
    </div>
    {searchParams?.saved && <p className="admin-success" role="status">Status updated.</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}

    <div className="admin-split">
      <div>
        <table className="admin-table">
          <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead>
          <tbody>
            {order.order_items.map((item) => <tr key={item.id}>
              <td><strong>{item.product_name}</strong></td>
              <td>{formatPrice(item.unit_price_paise)}</td>
              <td>{item.quantity}</td>
              <td>{formatPrice(item.unit_price_paise * item.quantity)}</td>
            </tr>)}
            <tr><td colSpan={3}>Delivery</td><td>{order.shipping_paise ? formatPrice(order.shipping_paise) : "Free"}</td></tr>
            <tr><td colSpan={3}><strong>Total</strong></td><td><strong>{formatPrice(order.total_paise)}</strong></td></tr>
          </tbody>
        </table>
        {order.notes && <p className="admin-note"><strong>Customer note:</strong> {order.notes}</p>}
        <p className="admin-note">Placed {dateFormat.format(new Date(order.created_at))}{order.paid_at && ` · paid ${dateFormat.format(new Date(order.paid_at))}`}{order.razorpay_payment_id && ` · Razorpay ${order.razorpay_payment_id}`}</p>
      </div>

      <aside className="admin-panel">
        <p className="eyebrow">SHIP TO</p>
        <address className="order-address">
          {order.customer_name}<br />{order.address_line1}<br />{order.address_line2 && <>{order.address_line2}<br /></>}{order.city}, {order.state} {order.pincode}
        </address>
        <p className="admin-note"><a href={`tel:+91${order.phone}`}>+91 {order.phone}</a> · <a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a><br /><a href={`mailto:${order.email}`}>{order.email}</a></p>

        {isPaid
          ? <form action={updateOrderStatus} className="admin-form order-status-form">
              <input type="hidden" name="id" value={order.id} />
              <label className="field"><span>Status</span>
                <select name="status" defaultValue={order.status}>
                  {PAID_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <SubmitButton>Update status</SubmitButton>
              <p className="admin-note">Cancelling doesn't refund — issue refunds from the Razorpay dashboard.</p>
            </form>
          : <p className="admin-note">This order hasn't been paid, so there's nothing to ship.</p>}
      </aside>
    </div>
  </>;
}
