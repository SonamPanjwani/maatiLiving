import ReportFrame from "@/components/books/ReportFrame";
import { reportStockValuation } from "@/src/lib/books/report-data";
import { reportParams } from "@/src/lib/books/report-params";
import { formatPrice } from "@/src/lib/format";

export default async function ValuationPage({ searchParams }) {
  const params = reportParams(searchParams);
  const v = await reportStockValuation(params.asOf);

  return <ReportFrame title="Stock valuation" report="valuation" params={params} fields={["asOf"]} csvParams={{ asOf: params.asOf }}
    intro="Pieces in stock at the end of the day, from the stock history. Cost is the average cost at that time; value at price uses today's selling price.">
    <section className="kpi-row kpi-row-3" aria-label="Totals">
      <div className="kpi"><span className="kpi-label">Pieces</span><span className="kpi-value">{v.units}</span><span className="kpi-note">{v.rows.length} products</span></div>
      <div className="kpi"><span className="kpi-label">Value at cost</span><span className="kpi-value">{formatPrice(v.valuePaise)}</span><span className="kpi-note">{v.uncosted ? `${v.uncosted} without a cost` : "All costed"}</span></div>
      <div className="kpi"><span className="kpi-label">Value at price</span><span className="kpi-value">{formatPrice(v.valueAtPricePaise)}</span></div>
    </section>
    {v.rows.length === 0
      ? <div className="books-empty"><p>No stock on that date.</p></div>
      : <table className="admin-table table-cards">
          <thead><tr><th>Product</th><th className="num">Pieces</th><th className="num">Cost each</th><th className="num">Value at cost</th><th className="num">Value at price</th></tr></thead>
          <tbody>{v.rows.map((row) => <tr key={row.id}>
            <td data-label="Product"><span className="cell-value"><a href={`/admin/inventory/${row.id}`}><strong>{row.name}</strong></a>{(row.category || row.sku) && <small>{[row.category, row.sku].filter(Boolean).join(" · ")}</small>}</span></td>
            <td data-label="Pieces" className="num">{row.qty}</td>
            <td data-label="Cost each" className="num">{row.costPaise != null ? formatPrice(row.costPaise) : <span className="muted">not set</span>}</td>
            <td data-label="Value at cost" className="num">{row.valuePaise != null ? formatPrice(row.valuePaise) : <span className="muted">—</span>}</td>
            <td data-label="Value at price" className="num">{formatPrice(row.valueAtPricePaise)}</td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row">Total</th><td data-label="Pieces" className="num">{v.units}</td><td className="no-card" /><td data-label="Value at cost" className="num">{formatPrice(v.valuePaise)}</td><td data-label="Value at price" className="num">{formatPrice(v.valueAtPricePaise)}</td></tr></tfoot>
        </table>}
  </ReportFrame>;
}
