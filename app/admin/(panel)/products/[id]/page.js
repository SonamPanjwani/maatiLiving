import { notFound } from "next/navigation";
import { deleteProduct } from "@/app/admin/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import ProductForm from "@/components/admin/ProductForm";
import { adminGetCategories, adminGetProduct } from "@/src/lib/admin-catalog";

export default async function EditProductPage({ params }) {
  const [product, categories] = await Promise.all([adminGetProduct(params.id), adminGetCategories()]);
  if (!product) notFound();

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">EDIT PRODUCT</p><h1>{product.name}</h1></div>
      <form action={deleteProduct}><input type="hidden" name="id" value={product.id} /><ConfirmSubmit message={`Delete “${product.name}” permanently? To keep it but take it off the shop, untick “Visible in shop” instead.`}>Delete product</ConfirmSubmit></form>
    </div>
    <ProductForm product={product} categories={categories} />
  </>;
}
