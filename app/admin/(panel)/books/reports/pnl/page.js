import ReportFrame from "@/components/books/ReportFrame";
import { reportProfitAndLoss } from "@/src/lib/books/report-data";
import { reportParams } from "@/src/lib/books/report-params";
import { formatMonth, formatSignedPrice as money } from "@/src/lib/format";

const monthLabel = (month) => (month === "total" ? "Total" : formatMonth(month, { short: true }));

export default async function ProfitLossPage({ searchParams }) {
  const params = reportParams(searchParams);
  const pl = await reportProfitAndLoss(params.fromMonth, params.toMonth);
  const cols = [...pl.columns, pl.total];
  const row = (label, get, className = "") => <tr className={className}><th scope="row">{label}</th>{cols.map((c) => <td key={c.month} className={`num ${c.month === "total" ? "pnl-total-col" : ""}`}>{get(c)}</td>)}</tr>;

  return <ReportFrame title="Profit & loss" report="pnl" params={params} fields={["months"]} csvParams={{ fromMonth: params.fromMonth, toMonth: params.toMonth }}
    intro="Sales count orders paid in the month that weren't cancelled or refunded. Cost of goods uses each item's cost when it was sold. Expenses are by the date spent.">
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Profit and loss table">
      <table className="admin-table pnl-table">
        <thead><tr><th><span className="sr-only">Line</span></th>{cols.map((c) => <th key={c.month} className={`num ${c.month === "total" ? "pnl-total-col" : ""}`} scope="col">{monthLabel(c.month)}</th>)}</tr></thead>
        <tbody>
          {row("Orders", (c) => c.orders)}
          {row("Sales (items)", (c) => money(c.salesPaise))}
          {row("Delivery charges", (c) => money(c.deliveryPaise))}
          {row("Revenue", (c) => money(c.revenuePaise), "pnl-sub")}
          {row("Cost of goods sold", (c) => money(c.cogsPaise))}
          {row("Gross profit", (c) => <span className="cell-value">{money(c.grossPaise)}{c.grossMarginPct != null && <small>{c.grossMarginPct}%</small>}</span>, "pnl-sub")}
          {pl.categories.map((name) => row(name, (c) => (c.expenses[name] ? money(c.expenses[name]) : <span className="muted">—</span>), "pnl-expense"))}
          {row("Total expenses", (c) => money(c.expensesPaise), "pnl-sub")}
          {row("Net profit", (c) => <span className={c.netPaise < 0 ? "admin-warn" : ""}>{money(c.netPaise)}</span>, "pnl-net")}
        </tbody>
      </table>
    </div>
    {pl.total.uncostedUnits > 0 && <p className="admin-note">{pl.total.uncostedUnits} {pl.total.uncostedUnits === 1 ? "piece was" : "pieces were"} sold before their product had a cost price, so cost of goods is lower than it really was. Set cost prices in Inventory (or receive a purchase) so new sales are right.</p>}
  </ReportFrame>;
}
