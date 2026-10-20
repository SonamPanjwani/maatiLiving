import { notFound, redirect } from "next/navigation";
import PurchaseForm from "@/components/books/PurchaseForm";
import { booksGetPurchase, booksGetPurchaseFormData } from "@/src/lib/books/data";
import { todayInIndia } from "@/src/lib/format";

export default async function EditPurchasePage({ params }) {
  const purchase = await booksGetPurchase(params.id);
  if (!purchase) notFound();
  if (purchase.status === "cancelled") redirect(`/admin/books/purchases/${purchase.id}?error=${encodeURIComponent("A cancelled purchase can't be edited.")}`);
  const { vendors, products, links } = await booksGetPurchaseFormData({ includeVendorId: purchase.vendor_id });

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS · PURCHASES</p><h1>{purchase.locked ? `Bill & notes · ${purchase.number}` : `Edit ${purchase.number}`}</h1></div>
      <a className="text-link" href={`/admin/books/purchases/${purchase.id}`}>Back to purchase</a>
    </div>
    {purchase.locked && <p className="admin-note archived-note">Stock has been received, so items and amounts are fixed. You can still add the vendor's bill, files and notes. To correct stock, use Adjust stock on the product and note it here.</p>}
    <PurchaseForm purchase={purchase} vendors={vendors} products={products} links={links} today={todayInIndia()} />
  </>;
}
