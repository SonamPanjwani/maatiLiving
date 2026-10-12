import { Plus } from "lucide-react";
import CloudImage from "@/components/common/CloudImage";
import { adminGetProducts } from "@/src/lib/admin-catalog";
import { formatPrice } from "@/src/lib/format";

export default async function AdminProductsPage({ searchParams }) {
  const products = await adminGetProducts();

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">CATALOGUE</p><h1>Products</h1></div>
      <a className="button button-dark" href="/admin/products/new"><Plus size={14} /> Add product</a>
    </div>
    {searchParams?.saved && <p className="admin-success" role="status">Saved “{searchParams.saved}”.</p>}

    {products.length === 0
      ? <p className="admin-empty">No products yet. <a className="text-link" href="/admin/products/new">Add your first product</a></p>
      : <table className="admin-table">
          <thead><tr><th>Photo</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Photos</th><th>Status</th></tr></thead>
          <tbody>
            {products.map((product) => <tr key={product.id}>
              <td className="admin-table-thumb">{product.images[0] ? <CloudImage src={product.images[0].publicId} alt={product.images[0].alt} width={96} height={96} crop="fill" gravity="auto" format="auto" quality="auto" /> : <span className="admin-thumb-empty" />}</td>
              <td><a href={`/admin/products/${product.id}`}><strong>{product.name}</strong></a><small>{product.sku}</small></td>
              <td>{product.category?.name ?? "—"}</td>
              <td>{formatPrice(product.price)}</td>
              <td className={product.stock === 0 ? "admin-warn" : ""}>{product.stock}</td>
              <td>{product.images.length}</td>
              <td>{product.available ? "Visible" : "Hidden"}{product.featured && " · Featured"}</td>
            </tr>)}
          </tbody>
        </table>}
  </>;
}
