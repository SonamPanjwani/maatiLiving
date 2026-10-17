import { updateStock } from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";
import { adminGetProducts } from "@/src/lib/admin-catalog";
import { formatPrice } from "@/src/lib/format";

const LOW_STOCK_AT = 5;

export default async function InventoryPage({ searchParams }) {
  const lowOnly = searchParams?.low === "1";
  const all = await adminGetProducts();
  const products = (lowOnly ? all.filter((product) => product.stock <= LOW_STOCK_AT) : all).sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  const back = lowOnly ? "/admin/inventory?low=1" : "/admin/inventory";
  const totalUnits = all.reduce((sum, product) => sum + product.stock, 0);
  const stockValue = all.reduce((sum, product) => sum + product.stock * product.price, 0);

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">CATALOGUE</p><h1>Inventory</h1></div>
      <p className="admin-note">{totalUnits} units in stock · {formatPrice(stockValue)} at selling price</p>
    </div>
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}

    <nav className="category-nav admin-tabs" aria-label="Filter"><ul>
      <li><a href="/admin/inventory" className={!lowOnly ? "is-active" : ""} aria-current={!lowOnly ? "page" : undefined}>All products</a></li>
      <li><a href="/admin/inventory?low=1" className={lowOnly ? "is-active" : ""} aria-current={lowOnly ? "page" : undefined}>Low stock ({LOW_STOCK_AT} or fewer)</a></li>
    </ul></nav>

    {products.length === 0
      ? <p className="admin-empty">{lowOnly ? "Nothing is running low." : "No products yet."}</p>
      : <table className="admin-table">
          <thead><tr><th>Product</th><th>Category</th><th className="num">Price</th><th>Stock</th></tr></thead>
          <tbody>
            {products.map((product) => <tr key={product.id}>
              <td><a href={`/admin/products/${product.id}`}><strong>{product.name}</strong></a><small>{product.sku}{!product.available && " · Hidden"}</small></td>
              <td>{product.category?.name ?? "—"}</td>
              <td className="num">{formatPrice(product.price)}</td>
              <td>
                <form action={updateStock} className="stock-form">
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="back" value={back} />
                  <input type="number" name="stock" min="0" step="1" defaultValue={product.stock} aria-label={`Stock for ${product.name}`} className={product.stock <= LOW_STOCK_AT ? "is-low" : ""} />
                  <SubmitButton className="admin-danger stock-save" pendingLabel="…">Save</SubmitButton>
                </form>
              </td>
            </tr>)}
          </tbody>
        </table>}
  </>;
}
