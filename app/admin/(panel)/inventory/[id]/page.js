import { notFound } from "next/navigation";
import { adjustStock, setCostPrice, setLowStockThreshold } from "@/app/admin/actions";
import AdjustStockSubmit from "@/components/books/AdjustStockSubmit";
import SubmitButton from "@/components/admin/SubmitButton";
import { paiseToRupeeInput } from "@/src/lib/books/money";
import { DEFAULT_LOW_STOCK, booksGetInventoryProduct } from "@/src/lib/books/data";
import { formatPrice } from "@/src/lib/format";

const REASONS = [["recount", "Recount"], ["damaged", "Damaged / broken"], ["lost", "Lost"], ["sample", "Sample / gift"], ["other", "Other (add a note)"]];
const MOVEMENT_LABELS = {
  opening_stock: "Opening stock",
  purchase_receipt: "Received from vendor",
  order_paid: "Sold (order paid)",
  order_cancel_restock: "Returned to stock (order cancelled)",
  manual_adjustment: "Adjustment",
};
const SAVED = { adjusted: "Stock adjusted.", cost: "Cost price saved.", threshold: "Low-stock level saved." };
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function InventoryProductPage({ params, searchParams }) {
  const product = await booksGetInventoryProduct(params.id);
  if (!product) notFound();

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">INVENTORY</p><h1>{product.name}</h1></div>
      <a className="text-link" href="/admin/inventory">All inventory</a>
    </div>
    {searchParams?.saved && <p className="admin-success" role="status">{SAVED[searchParams.saved] ?? "Saved."}</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}

    <section className="kpi-row kpi-row-4" aria-label="Stock figures">
      <div className="kpi"><span className="kpi-label">In stock</span><span className="kpi-value">{product.stock}</span><span className="kpi-note">{product.stock <= product.lowStockAt ? `Low (alert at ${product.lowStockAt})` : `Alert at ${product.lowStockAt}`}</span></div>
      <div className="kpi"><span className="kpi-label">Cost price</span><span className="kpi-value">{product.costPaise != null ? formatPrice(product.costPaise) : "Not set"}</span><span className="kpi-note">Selling at {formatPrice(product.pricePaise)}</span></div>
      <div className="kpi"><span className="kpi-label">Margin</span><span className="kpi-value">{product.marginPct != null ? `${product.marginPct}%` : "—"}</span><span className="kpi-note">{product.costPaise != null ? `${formatPrice(product.pricePaise - product.costPaise)} per piece` : "Set a cost price"}</span></div>
      <div className="kpi"><span className="kpi-label">Stock value</span><span className="kpi-value">{product.valueAtCostPaise != null ? formatPrice(product.valueAtCostPaise) : "—"}</span><span className="kpi-note">{formatPrice(product.valueAtPricePaise)} at selling price</span></div>
    </section>

    <div className="admin-split">
      <section>
        <h2 className="eyebrow">STOCK HISTORY</h2>
        {product.movements.length === 0
          ? <p className="admin-note">No stock movements yet.</p>
          : <table className="admin-table table-cards">
              <thead><tr><th>When</th><th>What</th><th className="num">Change</th><th className="num">After</th></tr></thead>
              <tbody>{product.movements.map((m) => <tr key={m.id}>
                <td data-label="When">{dateFormat.format(new Date(m.created_at))}</td>
                <td data-label="What"><span className="cell-value">{MOVEMENT_LABELS[m.reason] ?? m.reason}{m.adjustment_reason && ` · ${m.adjustment_reason}`}
                  {m.ref_type === "order" && m.ref_id && <small><a href={`/admin/orders/${m.ref_id}`}>View order</a></small>}
                  {m.ref_type === "purchase" && m.ref_id && <small><a href={`/admin/books/purchases/${m.ref_id}`}>View purchase</a>{m.unit_cost_paise != null && ` · ${formatPrice(m.unit_cost_paise)} landed per piece`}</small>}
                  {m.note && <small>{m.note}</small>}</span></td>
                <td data-label="Change" className={`num ${m.qty_change < 0 ? "qty-out" : "qty-in"}`}>{m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}</td>
                <td data-label="After" className="num">{m.stock_after}</td>
              </tr>)}</tbody>
            </table>}
      </section>

      <aside className="admin-panel books-side">
        <form action={adjustStock} className="admin-form">
          <h2 className="eyebrow">ADJUST STOCK</h2>
          <input type="hidden" name="id" value={product.id} />
          <fieldset className="segmented">
            <legend className="sr-only">Add or remove</legend>
            <label><input type="radio" name="direction" value="add" defaultChecked /> Add</label>
            <label><input type="radio" name="direction" value="remove" /> Remove</label>
          </fieldset>
          <label className="field"><span>How many pieces</span><input name="qty" type="number" inputMode="numeric" min="1" step="1" required /></label>
          <label className="field"><span>Reason</span>
            <select name="reason" required defaultValue="">
              <option value="" disabled>Choose a reason</option>
              {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field"><span>Note <small>required for "Other"</small></span><input name="note" maxLength={300} /></label>
          <AdjustStockSubmit productName={product.name} currentStock={product.stock} />
          <p className="admin-note">Stock can't go below zero. Stock from vendors comes in through Purchases → Receive items.</p>
        </form>

        <form action={setCostPrice} className="admin-form books-side-block">
          <h2 className="eyebrow">COST PRICE</h2>
          <input type="hidden" name="id" value={product.id} />
          <label className="field"><span>Cost per piece (₹) <small>what it costs you; blank = not set</small></span><input name="cost" type="number" min="0.01" step="0.01" inputMode="decimal" defaultValue={paiseToRupeeInput(product.costPaise)} placeholder="e.g. 180" /></label>
          <SubmitButton>Save cost</SubmitButton>
          <p className="admin-note">Receiving a purchase updates this automatically: the average of the stock you had and the new delivery (including its share of shipping).</p>
        </form>

        <form action={setLowStockThreshold} className="admin-form books-side-block">
          <h2 className="eyebrow">LOW-STOCK ALERT</h2>
          <input type="hidden" name="id" value={product.id} />
          <label className="field"><span>Alert when stock is at or below <small>blank = {DEFAULT_LOW_STOCK}</small></span><input name="threshold" type="number" inputMode="numeric" min="0" step="1" defaultValue={product.hasOwnThreshold ? product.lowStockAt : ""} /></label>
          <SubmitButton>Save alert level</SubmitButton>
        </form>
      </aside>
    </div>
  </>;
}
