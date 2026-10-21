import { Plus } from "lucide-react";
import RevenueChart from "@/components/admin/RevenueChart";
import RecurringDue from "@/components/books/RecurringDue";
import { booksGetRecurringDue } from "@/src/lib/books/data";
import { adminGetDashboard } from "@/src/lib/admin-catalog";
import { formatPrice } from "@/src/lib/format";
import { adminStatusLabel } from "@/src/lib/order-status";

const LOW_STOCK_AT = 5;
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function AdminDashboard({ searchParams }) {
  // Books reminders are optional here: if the expenses migration (0011) isn't run yet, the dashboard still loads.
  const [data, due] = await Promise.all([
    adminGetDashboard({ lowStockAt: LOW_STOCK_AT }),
    booksGetRecurringDue().catch(() => []),
  ]);

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">OVERVIEW</p><h1>Dashboard</h1></div>
      <div className="admin-quick-actions">
        <a className="button button-dark" href="/admin/products/new"><Plus size={14} /> Add product</a>
        <a className="stock-save" href="/admin/categories"><Plus size={14} /> Add category</a>
      </div>
    </div>

    {searchParams?.saved === "skipped" && <p className="admin-success" role="status">Skipped. The reminder moved to the next date.</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}
    {due.length > 0 && <section className="admin-card books-due" aria-label="Repeating expenses due">
      <h2 className="eyebrow">DUE TO PAY <small>repeating expenses, next 7 days</small></h2>
      <RecurringDue items={due} back="dashboard" />
    </section>}

    {data.upiToVerify > 0 && <a className="upi-banner" href="/admin/orders?tab=upi">{data.upiToVerify} UPI {data.upiToVerify === 1 ? "payment" : "payments"} waiting for you to check in your bank app. Open →</a>}

    <section className="kpi-row" aria-label="Key figures">
      <div className="kpi kpi-hero">
        <span className="kpi-label">Revenue, last 30 days</span>
        <span className="kpi-value">{formatPrice(data.month.revenuePaise)}</span>
        <span className="kpi-note">{plural(data.month.orders, "order")}</span>
      </div>
      <div className="kpi"><span className="kpi-label">Today</span><span className="kpi-value">{formatPrice(data.today.revenuePaise)}</span><span className="kpi-note">{plural(data.today.orders, "order")}</span></div>
      <div className="kpi"><span className="kpi-label">Last 7 days</span><span className="kpi-value">{formatPrice(data.week.revenuePaise)}</span><span className="kpi-note">{plural(data.week.orders, "order")}</span></div>
      <a className="kpi kpi-link" href="/admin/orders?tab=to-ship"><span className="kpi-label">Waiting to ship</span><span className="kpi-value">{data.toShip}</span><span className="kpi-note">Open orders →</span></a>
      <a className="kpi kpi-link" href="/admin/inventory?low=1"><span className="kpi-label">Low stock</span><span className="kpi-value">{data.lowStock.length}</span><span className="kpi-note">At or below their alert level →</span></a>
    </section>

    <section className="admin-card"><RevenueChart days={data.days} /></section>

    <div className="dashboard-grid">
      <section className="admin-card">
        <h2 className="eyebrow">RECENT ORDERS</h2>
        {data.recent.length === 0 ? <p className="admin-note">No orders yet.</p> : <table className="admin-table">
          <tbody>{data.recent.map((order) => <tr key={order.id}>
            <td><a href={`/admin/orders/${order.id}`}><strong>{order.order_number}</strong></a><small>{dateFormat.format(new Date(order.created_at))}</small></td>
            <td>{order.customer_name}</td>
            <td className="num">{formatPrice(order.total_paise)}</td>
            <td className={order.status === "paid" ? "admin-warn" : ""}>{adminStatusLabel(order)}</td>
          </tr>)}</tbody>
        </table>}
      </section>

      <section className="admin-card">
        <h2 className="eyebrow">BEST SELLERS · 30 DAYS</h2>
        {data.bestSellers.length === 0 ? <p className="admin-note">Nothing sold yet.</p> : <table className="admin-table">
          <tbody>{data.bestSellers.map((product) => <tr key={product.name}>
            <td><strong>{product.name}</strong></td>
            <td className="num">{product.quantity} sold</td>
            <td className="num">{formatPrice(product.revenuePaise)}</td>
          </tr>)}</tbody>
        </table>}
      </section>

      <section className="admin-card">
        <h2 className="eyebrow">LOW STOCK</h2>
        {data.lowStock.length === 0 ? <p className="admin-note">Nothing is at or below its low-stock alert level.</p> : <table className="admin-table">
          <tbody>{data.lowStock.map((product) => <tr key={product.id}>
            <td><a href={`/admin/products/${product.id}`}><strong>{product.name}</strong></a>{!product.is_available && <small>Hidden</small>}</td>
            <td className={`num ${product.stock === 0 ? "admin-warn" : ""}`}>{product.stock === 0 ? "Sold out" : `${product.stock} left`}</td>
          </tr>)}</tbody>
        </table>}
        <a className="text-link" href="/admin/inventory">Manage stock</a>
      </section>
    </div>
  </>;
}
