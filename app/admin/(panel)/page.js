import { Plus } from "lucide-react";
import RevenueChart from "@/components/admin/RevenueChart";
import CashFlowChart from "@/components/books/CashFlowChart";
import RecurringDue from "@/components/books/RecurringDue";
import { booksGetRecurringDue } from "@/src/lib/books/data";
import { booksGetDashboardFigures } from "@/src/lib/books/report-data";
import { pctChange } from "@/src/lib/books/reports";
import { adminGetDashboard } from "@/src/lib/admin-catalog";
import { formatDate, formatPrice, formatSignedPrice as money } from "@/src/lib/format";
import { adminStatusLabel } from "@/src/lib/order-status";

const LOW_STOCK_AT = 5;
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function AdminDashboard({ searchParams }) {
  // Books reminders are optional here: if the expenses migration (0011) isn't run yet, the dashboard still loads.
  const [data, due, books] = await Promise.all([
    adminGetDashboard({ lowStockAt: LOW_STOCK_AT }),
    booksGetRecurringDue().catch(() => []),
    booksGetDashboardFigures().catch(() => null),
  ]);
  const now = books?.thisMonth;
  const before = books?.lastMonth;
  // "vs last month" note for a figure; null when there's nothing to compare.
  const versus = (key) => {
    if (!now || !before) return null;
    const change = pctChange(now[key], before[key]);
    return change == null ? `last month ${formatPrice(before[key])}` : `${change >= 0 ? "+" : "−"}${Math.abs(change)}% vs last month`;
  };

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

    {now && <section className="kpi-row books-kpis" aria-label="This month's profit">
      <a className="kpi kpi-hero kpi-link" href="/admin/books/reports/pnl"><span className="kpi-label">Net profit this month</span><span className={`kpi-value ${now.netPaise < 0 ? "admin-warn" : ""}`}>{money(now.netPaise)}</span><span className="kpi-note">{versus("netPaise") ?? "Profit & loss →"}</span></a>
      <div className="kpi"><span className="kpi-label">Revenue</span><span className="kpi-value">{formatPrice(now.revenuePaise)}</span><span className="kpi-note">{versus("revenuePaise")}</span></div>
      <div className="kpi"><span className="kpi-label">Cost of goods</span><span className="kpi-value">{formatPrice(now.cogsPaise)}</span><span className="kpi-note">{now.uncostedUnits ? `${now.uncostedUnits} ${now.uncostedUnits === 1 ? "piece" : "pieces"} without cost` : versus("cogsPaise")}</span></div>
      <div className="kpi"><span className="kpi-label">Gross profit</span><span className="kpi-value">{money(now.grossPaise)}</span><span className="kpi-note">{now.grossMarginPct != null ? `${now.grossMarginPct}% margin` : versus("grossPaise")}</span></div>
      <a className="kpi kpi-link" href="/admin/books/expenses"><span className="kpi-label">Expenses</span><span className="kpi-value">{formatPrice(now.expensesPaise)}</span><span className="kpi-note">{versus("expensesPaise") ?? "Expenses →"}</span></a>
    </section>}

    {(books?.payables || books?.cashFlow) && <div className="dashboard-grid books-dashboard">
      {books.payables && <section className="admin-card">
        <h2 className="eyebrow">PAYABLES</h2>
        <p className="kpi-value">{formatPrice(books.payables.totalDuePaise)}</p>
        <p className={`admin-note ${books.payables.overdueCount ? "admin-warn" : ""}`}>{books.payables.overdueCount ? `${books.payables.overdueCount} overdue · ${formatPrice(books.payables.overduePaise)}` : "Nothing overdue"}</p>
        {books.payables.next.length > 0 && <table className="admin-table">
          <thead className="sr-only"><tr><th>Bill</th><th>Due</th><th>Still to pay</th></tr></thead>
          <tbody>{books.payables.next.map((bill) => <tr key={`${bill.vendor.id}-${bill.key}`}>
            <td>{bill.purchaseId ? <a href={`/admin/books/purchases/${bill.purchaseId}`}><strong>{bill.label}</strong></a> : <strong>{bill.label}</strong>}<small>{bill.vendor.name}</small></td>
            <td className={bill.overdueDays ? "admin-warn" : ""}>{formatDate(bill.dueDate)}{bill.overdueDays > 0 && <small>overdue</small>}</td>
            <td className="num">{formatPrice(bill.balancePaise)}</td>
          </tr>)}</tbody>
        </table>}
        <a className="text-link" href="/admin/books/payables">All payables</a>
      </section>}
      {books.cashFlow && <section className="admin-card cash-card"><CashFlowChart months={books.cashFlow} /></section>}
    </div>}

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
        <a className="text-link" href={data.lowStock.length ? "/admin/inventory?low=1" : "/admin/inventory"}>{data.lowStock.length ? "Reorder" : "Manage stock"}</a>
      </section>
    </div>
  </>;
}
