import ReportFrame from "@/components/books/ReportFrame";
import { reportPayablesAgeing } from "@/src/lib/books/report-data";
import { reportParams } from "@/src/lib/books/report-params";
import { AGEING_BUCKETS } from "@/src/lib/books/reports";
import { formatPrice } from "@/src/lib/format";

const cell = (paise) => (paise ? formatPrice(paise) : <span className="muted">—</span>);

export default async function AgeingPage({ searchParams }) {
  const params = reportParams(searchParams);
  const ageing = await reportPayablesAgeing();

  return <ReportFrame title="Payables ageing" report="ageing" params={params}
    intro="What's still to pay, by how many days ago the bill was dated (or the order, when there's no bill date). Opening balances count from the day the vendor was added. Payments not linked to a bill aren't taken off here — apply them from the payment's page.">
    {ageing.rows.length === 0
      ? <div className="books-empty"><p>Nothing to pay.</p></div>
      : <table className="admin-table table-cards">
          <thead><tr><th>Vendor</th>{AGEING_BUCKETS.map(([label]) => <th key={label} className="num">{label}</th>)}<th className="num">Total</th></tr></thead>
          <tbody>{ageing.rows.map((row) => <tr key={row.vendor.id}>
            <td data-label="Vendor"><a href={`/admin/books/vendors/${row.vendor.id}?tab=statement`}><strong>{row.vendor.name}</strong></a></td>
            {AGEING_BUCKETS.map(([label], i) => <td key={label} data-label={label} className={`num ${i >= 2 && row.buckets[i] ? "admin-warn" : ""}`}>{cell(row.buckets[i])}</td>)}
            <td data-label="Total" className="num"><strong>{formatPrice(row.totalPaise)}</strong></td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row">Total</th>{ageing.totals.map((paise, i) => <td key={AGEING_BUCKETS[i][0]} data-label={AGEING_BUCKETS[i][0]} className="num">{cell(paise)}</td>)}<td data-label="Total" className="num"><strong>{formatPrice(ageing.totalPaise)}</strong></td></tr></tfoot>
        </table>}
  </ReportFrame>;
}
