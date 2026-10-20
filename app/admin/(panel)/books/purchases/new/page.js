import PurchaseForm from "@/components/books/PurchaseForm";
import { booksGetPurchaseFormData } from "@/src/lib/books/data";
import { todayInIndia } from "@/src/lib/format";

export default async function NewPurchasePage({ searchParams }) {
  const { vendors, products, links } = await booksGetPurchaseFormData();
  const defaultVendorId = vendors.some((vendor) => vendor.id === searchParams?.vendor) ? searchParams.vendor : "";

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS · PURCHASES</p><h1>New purchase</h1></div>
      <a className="text-link" href="/admin/books/purchases">All purchases</a>
    </div>
    {vendors.length === 0
      ? <div className="books-empty"><p>Add a vendor first — every purchase is from someone.</p><a className="button button-dark" href="/admin/books/vendors/new">Add a vendor</a></div>
      : <PurchaseForm vendors={vendors} products={products} links={links} defaultVendorId={defaultVendorId} today={todayInIndia()} />}
  </>;
}
