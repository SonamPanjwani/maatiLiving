import { Download } from "lucide-react";
import { adminGetOrders } from "@/src/lib/admin-catalog";
import { formatPrice } from "@/src/lib/format";
import { ORDER_TABS, adminStatusLabel } from "@/src/lib/order-status";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function AdminOrdersPage({ searchParams }) {
  const searching = Boolean(searchParams?.q || searchParams?.from || searchParams?.to);
  // A search looks across every order (any status) unless a tab was picked explicitly.
  const SEARCH_ALL = { key: "search", label: "All", statuses: null };
  const tab = ORDER_TABS.find((item) => item.key === searchParams?.tab) ?? (searching ? SEARCH_ALL : ORDER_TABS[0]);
  const filters = { statuses: tab.statuses, paymentMethod: tab.paymentMethod, paidOnly: tab.paidOnly, q: searchParams?.q, from: searchParams?.from, to: searchParams?.to };
  const found = await adminGetOrders(filters);
  // UPI tab: orders where the customer says they've paid come first.
  const orders = tab.key === "upi" ? [...found].sort((a, b) => Number(Boolean(b.payment_reference)) - Number(Boolean(a.payment_reference))) : found;
  const exportQuery = new URLSearchParams(Object.entries({ tab: tab.key, q: filters.q, from: filters.from, to: filters.to }).filter(([, value]) => value)).toString();

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">SALES</p><h1>Orders</h1></div>
      <a className="button button-dark" href={`/admin/orders/export?${exportQuery}`}><Download size={14} /> Export CSV</a>
    </div>

    <form className="admin-filters" action="/admin/orders">
      <label className="field"><span>Search</span><input name="q" defaultValue={searchParams?.q ?? ""} placeholder="Order no., name, email or phone" /></label>
      <label className="field"><span>From</span><input type="date" name="from" defaultValue={searchParams?.from ?? ""} /></label>
      <label className="field"><span>To</span><input type="date" name="to" defaultValue={searchParams?.to ?? ""} /></label>
      <button type="submit" className="button button-dark">Search</button>
      {searching && <a className="text-link" href="/admin/orders">Clear</a>}
    </form>

    <nav className="category-nav admin-tabs" aria-label="Order status"><ul>
      {ORDER_TABS.map((item) => {
        const params = new URLSearchParams(Object.entries({ tab: item.key, q: filters.q, from: filters.from, to: filters.to }).filter(([, value]) => value));
        return <li key={item.key}><a href={`/admin/orders?${params}`} className={item.key === tab.key ? "is-active" : ""} aria-current={item.key === tab.key ? "page" : undefined}>{item.label}</a></li>;
      })}
    </ul></nav>

    {tab.key === "upi" && <p className="admin-note upi-tab-note">Orders with a transaction ID are listed first. Only confirm after you've seen the money in your own bank or UPI app. Orders with no transaction ID and no WhatsApp message after a day or two can be cancelled.</p>}

    {orders.length === 0
      ? <p className="admin-empty">{searching ? "No orders match that search." : "No orders here yet."}</p>
      : <table className="admin-table">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {orders.map((order) => <tr key={order.id}>
              <td><a href={`/admin/orders/${order.id}`}><strong>{order.order_number}</strong></a></td>
              <td>{dateFormat.format(new Date(order.paid_at ?? order.created_at))}</td>
              <td>{order.customer_name}<small>{order.city}, {order.state}</small></td>
              <td className="num">{order.order_items.reduce((sum, item) => sum + item.quantity, 0)}</td>
              <td className="num">{formatPrice(order.total_paise)}</td>
              <td className={order.status === "paid" || order.payment_reference && order.status === "pending" ? "admin-warn" : ""}>{adminStatusLabel(order)}</td>
            </tr>)}
          </tbody>
        </table>}
    {orders.length === 300 && <p className="admin-note">Showing the latest 300. Narrow the dates or search to see older orders, or export the CSV.</p>}
  </>;
}
