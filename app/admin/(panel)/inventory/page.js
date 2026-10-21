import { createReorderDraft } from "@/app/admin/(panel)/books/purchases/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { booksGetInventory, booksGetPurchaseFormData } from "@/src/lib/books/data";
import { reorderGroups } from "@/src/lib/books/reorder";
import { formatPrice } from "@/src/lib/format";

export default async function InventoryPage({ searchParams }) {
  const lowOnly = searchParams?.low === "1";
  const all = await booksGetInventory();
  const products = (lowOnly ? all.filter((product) => product.stock <= product.lowStockAt) : all)
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  const totalUnits = all.reduce((sum, product) => sum + product.stock, 0);
  const valueAtPrice = all.reduce((sum, product) => sum + product.valueAtPricePaise, 0);
  const costed = all.filter((product) => product.valueAtCostPaise != null);
  const valueAtCost = costed.reduce((sum, product) => sum + product.valueAtCostPaise, 0);
  const missingCost = all.length - costed.length;
  const reorder = lowOnly ? reorderGroups(all, (await booksGetPurchaseFormData()).links) : null;

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS</p><h1>Inventory</h1></div>
      <p className="admin-note">
        {totalUnits} units · {formatPrice(valueAtPrice)} at selling price · {formatPrice(valueAtCost)} at cost
        {missingCost > 0 && <><br />{missingCost} {missingCost === 1 ? "product has" : "products have"} no cost price yet</>}
      </p>
    </div>

    <nav className="category-nav admin-tabs" aria-label="Filter"><ul>
      <li><a href="/admin/inventory" className={!lowOnly ? "is-active" : ""} aria-current={!lowOnly ? "page" : undefined}>All products</a></li>
      <li><a href="/admin/inventory?low=1" className={lowOnly ? "is-active" : ""} aria-current={lowOnly ? "page" : undefined}>Low stock</a></li>
    </ul></nav>

    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}

    {reorder && (reorder.groups.length > 0 || reorder.noVendor.length > 0) && <section className="admin-panel reorder-panel" aria-label="Reorder">
      <h2 className="eyebrow">REORDER</h2>
      <p className="admin-note">A draft purchase per preferred vendor, with enough to get back to twice the low-stock level. You check it before sending.</p>
      <ul className="reorder-groups">{reorder.groups.map((group) => <li key={group.vendor.id}>
        <div><strong>{group.vendor.name}</strong>
          <small>{group.lines.map((line) => `${line.name} × ${line.qty}`).join(", ") || "No prices yet"}{group.missingCost.length > 0 && ` · no price for ${group.missingCost.join(", ")} (add their last cost on the vendor page)`}</small></div>
        {group.lines.length > 0 && <form action={createReorderDraft}>
          <input type="hidden" name="vendorId" value={group.vendor.id} />
          <ConfirmSubmit className="stock-save" message={`Create a draft purchase from ${group.vendor.name}?\n\n${group.lines.map((line) => `• ${line.name}: ${line.qty} (${line.stock} in stock)`).join("\n")}\n\nNothing is sent; you can edit it first.`}>Create reorder draft</ConfirmSubmit>
        </form>}
      </li>)}</ul>
      {reorder.noVendor.length > 0 && <p className="admin-note">No preferred vendor for {reorder.noVendor.join(", ")}. Set one on the vendor's "Products supplied" tab.</p>}
    </section>}

    {products.length === 0
      ? <p className="admin-empty">{lowOnly ? "Nothing is running low." : "No products yet."}</p>
      : <table className="admin-table table-cards">
          <thead><tr><th>Product</th><th className="num">Stock</th><th className="num">Cost</th><th className="num">Price</th><th className="num">Margin</th><th className="num">Value at cost</th><th className="num">Value at price</th><th>Preferred vendor</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {products.map((product) => <tr key={product.id}>
              <td data-label="Product"><a href={`/admin/inventory/${product.id}`}><strong>{product.name}</strong></a><small>{[product.category, product.sku, !product.available && "Hidden"].filter(Boolean).join(" · ")}</small></td>
              <td data-label="Stock" className={`num ${product.stock <= product.lowStockAt ? "admin-warn" : ""}`}><span className="cell-value">{product.stock}{product.stock <= product.lowStockAt && <small>low (≤ {product.lowStockAt})</small>}</span></td>
              <td data-label="Cost" className="num">{product.costPaise != null ? formatPrice(product.costPaise) : <span className="muted">not set</span>}</td>
              <td data-label="Price" className="num">{formatPrice(product.pricePaise)}</td>
              <td data-label="Margin" className="num">{product.marginPct != null ? `${product.marginPct}%` : <span className="muted">—</span>}</td>
              <td data-label="Value at cost" className="num">{product.valueAtCostPaise != null ? formatPrice(product.valueAtCostPaise) : <span className="muted">—</span>}</td>
              <td data-label="Value at price" className="num">{formatPrice(product.valueAtPricePaise)}</td>
              <td data-label="Preferred vendor">{product.preferredVendor ? <a href={`/admin/books/vendors/${product.preferredVendor.id}`}>{product.preferredVendor.name}</a> : <span className="muted">—</span>}</td>
              <td className="table-action"><a className="stock-save" href={`/admin/inventory/${product.id}`}>Adjust</a></td>
            </tr>)}
          </tbody>
        </table>}
  </>;
}
