import ReportFrame from "@/components/books/ReportFrame";
import { reportExpenses } from "@/src/lib/books/report-data";
import { reportParams } from "@/src/lib/books/report-params";
import { formatPrice } from "@/src/lib/format";

export default async function ExpensesReportPage({ searchParams }) {
  const params = reportParams(searchParams);
  const report = await reportExpenses(params.from, params.to);

  return <ReportFrame title="Expenses by category" report="expenses" params={params} fields={["range"]} csvParams={{ from: params.from, to: params.to }}
    intro="Active expenses by the date spent (voided ones aren't counted). The CSV lists every expense.">
    {report.categories.length === 0
      ? <div className="books-empty"><p>No expenses in these dates.</p></div>
      : <table className="admin-table table-cards">
          <thead><tr><th>Category</th><th className="num">Expenses</th><th className="num">GST in it</th><th className="num">Total</th><th className="num">Share</th></tr></thead>
          <tbody>{report.categories.map((row) => <tr key={row.name}>
            <td data-label="Category"><strong>{row.name}</strong></td>
            <td data-label="Expenses" className="num">{row.count}</td>
            <td data-label="GST in it" className="num">{row.taxPaise ? formatPrice(row.taxPaise) : <span className="muted">—</span>}</td>
            <td data-label="Total" className="num">{formatPrice(row.totalPaise)}</td>
            <td data-label="Share" className="num">{report.totalPaise ? `${Math.round((row.totalPaise / report.totalPaise) * 1000) / 10}%` : "—"}</td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row">Total</th><td data-label="Expenses" className="num">{report.expenses.length}</td><td data-label="GST in it" className="num">{formatPrice(report.taxPaise)}</td><td data-label="Total" className="num"><strong>{formatPrice(report.totalPaise)}</strong></td><td className="no-card" /></tr></tfoot>
        </table>}
  </ReportFrame>;
}
