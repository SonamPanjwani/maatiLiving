import ReportFrame from "@/components/books/ReportFrame";
import { reportStockMovements } from "@/src/lib/books/report-data";
import { reportParams } from "@/src/lib/books/report-params";
import { formatDateTime, formatPrice } from "@/src/lib/format";

const WHAT = { opening_stock: "Opening stock", purchase_receipt: "Purchase received", order_paid: "Order paid", order_cancel_restock: "Order cancelled, restocked", manual_adjustment: "Adjustment" };
const REF = { order: "orders", purchase: "books/purchases" };
const SHOWN = 500;

export default async function MovementsPage({ searchParams }) {
  const params = reportParams(searchParams);
  const rows = await reportStockMovements(params.from, params.to);
  const totalIn = rows.filter((m) => m.qty_change > 0).reduce((sum, m) => sum + m.qty_change, 0);
  const totalOut = rows.filter((m) => m.qty_change < 0).reduce((sum, m) => sum - m.qty_change, 0);

  return <ReportFrame title="Stock ledger" report="movements" params={params} fields={["range"]} csvParams={{ from: params.from, to: params.to }}
    intro="Every change to stock in these dates, oldest first. The stock history can't be edited; corrections are new adjustments.">
    <section className="kpi-row kpi-row-3" aria-label="Totals">
      <div className="kpi"><span className="kpi-label">Changes</span><span className="kpi-value">{rows.length}</span></div>
      <div className="kpi"><span className="kpi-label">Pieces in</span><span className="kpi-value">+{totalIn}</span></div>
      <div className="kpi"><span className="kpi-label">Pieces out</span><span className="kpi-value">−{totalOut}</span></div>
    </section>
    {rows.length === 0
      ? <div className="books-empty"><p>No stock changes in these dates.</p></div>
      : <>
          <table className="admin-table table-cards">
            <thead><tr><th>When</th><th>Product</th><th>What</th><th className="num">Change</th><th className="num">Stock after</th><th className="num">Cost each</th></tr></thead>
            <tbody>{rows.slice(0, SHOWN).map((m) => <tr key={m.id}>
              <td data-label="When">{formatDateTime(m.created_at)}</td>
              <td data-label="Product"><a href={`/admin/inventory/${m.product?.id}`}><strong>{m.product?.name}</strong></a></td>
              <td data-label="What"><span className="cell-value">{m.ref_type && REF[m.ref_type] && m.ref_id ? <a className="inline-link" href={`/admin/${REF[m.ref_type]}/${m.ref_id}`}>{WHAT[m.reason] ?? m.reason}</a> : WHAT[m.reason] ?? m.reason}
                {(m.adjustment_reason || m.note) && <small>{[m.adjustment_reason, m.note].filter(Boolean).join(" · ")}</small>}</span></td>
              <td data-label="Change" className={`num ${m.qty_change < 0 ? "qty-out" : "qty-in"}`}>{m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}</td>
              <td data-label="Stock after" className="num">{m.stock_after}</td>
              <td data-label="Cost each" className="num">{m.unit_cost_paise != null ? formatPrice(m.unit_cost_paise) : <span className="muted">—</span>}</td>
            </tr>)}</tbody>
          </table>
          {rows.length > SHOWN && <p className="admin-note">Showing the first {SHOWN} of {rows.length}. The CSV has all of them.</p>}
        </>}
  </ReportFrame>;
}
