import ReportFrame from "@/components/books/ReportFrame";
import { reportProductMargins } from "@/src/lib/books/report-data";
import { reportParams } from "@/src/lib/books/report-params";
import { formatPrice, formatSignedPrice } from "@/src/lib/format";

export default async function MarginPage({ searchParams }) {
  const params = reportParams(searchParams);
  const by = searchParams?.by === "category" ? "category" : "product";
  const margins = await reportProductMargins(params.from, params.to);
  const rows = by === "category" ? margins.categories : margins.products;
  const total = rows.reduce((t, x) => ({ units: t.units + x.units, revenue: t.revenue + x.revenuePaise, costedRevenue: t.costedRevenue + x.costedRevenuePaise, cogs: t.cogs + x.cogsPaise, gross: t.gross + x.grossPaise }), { units: 0, revenue: 0, costedRevenue: 0, cogs: 0, gross: 0 });
  const totalMargin = total.costedRevenue ? Math.round((total.gross / total.costedRevenue) * 1000) / 10 : null;
  const tab = (value) => `/admin/books/reports/margin?${new URLSearchParams({ from: params.from, to: params.to, by: value })}`;

  return <ReportFrame title="Product margin" report="margin" params={params} fields={["range"]} hidden={{ by }} csvParams={{ from: params.from, to: params.to, by }} periodNote={by === "category" ? "by category" : "by product"}
    intro="Margin = (revenue − cost of goods) ÷ revenue, over pieces whose cost was known when sold. Cancelled and refunded orders aren't counted.">
    <nav className="category-nav admin-tabs no-print" aria-label="Group by"><ul>
      <li><a href={tab("product")} className={by === "product" ? "is-active" : ""} aria-current={by === "product" ? "page" : undefined}>By product</a></li>
      <li><a href={tab("category")} className={by === "category" ? "is-active" : ""} aria-current={by === "category" ? "page" : undefined}>By category</a></li>
    </ul></nav>
    {rows.length === 0
      ? <div className="books-empty"><p>Nothing sold in these dates.</p></div>
      : <table className="admin-table table-cards">
          <thead><tr><th>{by === "category" ? "Category" : "Product"}</th><th className="num">Units</th><th className="num">Revenue</th><th className="num">Cost of goods</th><th className="num">Gross profit</th><th className="num">Margin</th></tr></thead>
          <tbody>{rows.map((x) => <tr key={x.key}>
            <td data-label={by === "category" ? "Category" : "Product"}><span className="cell-value"><strong>{x.name}</strong>{x.uncostedUnits > 0 && <small>{x.uncostedUnits} without cost</small>}</span></td>
            <td data-label="Units" className="num">{x.units}</td>
            <td data-label="Revenue" className="num">{formatPrice(x.revenuePaise)}</td>
            <td data-label="Cost of goods" className="num">{formatPrice(x.cogsPaise)}</td>
            <td data-label="Gross profit" className="num">{formatSignedPrice(x.grossPaise)}</td>
            <td data-label="Margin" className="num">{x.marginPct != null ? `${x.marginPct}%` : <span className="muted">—</span>}</td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row">Total</th><td data-label="Units" className="num">{total.units}</td><td data-label="Revenue" className="num">{formatPrice(total.revenue)}</td><td data-label="Cost of goods" className="num">{formatPrice(total.cogs)}</td><td data-label="Gross profit" className="num">{formatSignedPrice(total.gross)}</td><td data-label="Margin" className="num">{totalMargin != null ? `${totalMargin}%` : "—"}</td></tr></tfoot>
        </table>}
  </ReportFrame>;
}
