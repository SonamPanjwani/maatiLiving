import ProductForm from "@/components/admin/ProductForm";
import { adminGetCategories } from "@/src/lib/admin-catalog";

export default async function NewProductPage() {
  const categories = await adminGetCategories();
  return <>
    <div className="admin-heading"><div><p className="eyebrow">CATALOGUE</p><h1>New <em>product</em></h1></div></div>
    {categories.length === 0
      ? <p className="admin-empty">Create a category first. <a className="text-link" href="/admin/categories">Go to categories</a></p>
      : <ProductForm categories={categories} />}
  </>;
}
