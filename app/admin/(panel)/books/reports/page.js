import { Archive } from "lucide-react";
import { reportParams } from "@/src/lib/books/report-params";

const REPORTS = [
  ["pnl", "Profit & loss", "Sales and delivery charges, minus what the goods cost, minus expenses — month by month."],
  ["margin", "Product margin", "Units sold, revenue, cost and margin for each product and category."],
  ["statement", "Vendor statement", "Opening balance, bills, payments and running balance for one vendor. Share or print."],
  ["ageing", "Payables ageing", "What you owe each vendor, split by how old the bills are: 0–30, 31–60, 61–90, 90+ days."],
  ["valuation", "Stock valuation", "Pieces in stock and their value at cost and at selling price, on any date."],
  ["movements", "Stock ledger", "Every stock change: purchases received, orders, restocks and adjustments."],
  ["expenses", "Expenses by category", "Where the money went, by category, with GST."],
];

export default function ReportsPage() {
  const { caMonth, today } = reportParams();

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS</p><h1>Reports</h1></div>
    </div>
    <ul className="report-cards">
      {REPORTS.map(([key, title, text]) => <li key={key}><a href={`/admin/books/reports/${key}`}>
        <strong>{title}</strong>
        <span>{text}</span>
      </a></li>)}
    </ul>

    <section className="admin-panel ca-export">
      <h2 className="eyebrow">CA EXPORT PACK</h2>
      <p className="admin-note">One ZIP with a month's sales, purchases, purchase items, vendor payments, expenses and stock valuation as CSV files, for your accountant (and later Zoho / Tally).</p>
      <form className="admin-filters" action="/admin/books/reports/ca-export">
        <label className="field" htmlFor="ca-month"><span>Month</span><input id="ca-month" type="month" name="month" defaultValue={caMonth} max={today.slice(0, 7)} required /></label>
        <button type="submit" className="button button-dark"><Archive size={14} /> Download ZIP</button>
      </form>
    </section>
  </>;
}
