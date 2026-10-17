import { adminGetOrders } from "@/src/lib/admin-catalog";
import { formatPrice } from "@/src/lib/format";
import { STATUS_LABELS } from "@/src/lib/order-status";

const TABS = [
  { key: "to-ship", label: "To ship", statuses: ["paid"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "all", label: "All paid", statuses: ["paid", "shipped", "delivered", "cancelled"] },
  { key: "unpaid", label: "Unpaid / failed", statuses: ["pending", "failed"] },
];

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function AdminOrdersPage({ searchParams }) {
  const tab = TABS.find((item) => item.key === searchParams?.tab) ?? TABS[0];
  const orders = await adminGetOrders({ statuses: tab.statuses });

  return <>
    <div className="admin-heading"><div><p className="eyebrow">SALES</p><h1>Orders</h1></div></div>
    <nav className="category-nav admin-tabs" aria-label="Order status"><ul>
      {TABS.map((item) => <li key={item.key}><a href={`/admin/orders?tab=${item.key}`} className={item.key === tab.key ? "is-active" : ""} aria-current={item.key === tab.key ? "page" : undefined}>{item.label}</a></li>)}
    </ul></nav>

    {orders.length === 0
      ? <p className="admin-empty">No orders here yet.</p>
      : <table className="admin-table">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {orders.map((order) => <tr key={order.id}>
              <td><a href={`/admin/orders/${order.id}`}><strong>{order.order_number}</strong></a></td>
              <td>{dateFormat.format(new Date(order.paid_at ?? order.created_at))}</td>
              <td>{order.customer_name}<small>{order.city}, {order.state}</small></td>
              <td>{order.order_items.reduce((sum, item) => sum + item.quantity, 0)}</td>
              <td>{formatPrice(order.total_paise)}</td>
              <td className={order.status === "paid" ? "admin-warn" : ""}>{STATUS_LABELS[order.status]}</td>
            </tr>)}
          </tbody>
        </table>}
  </>;
}
