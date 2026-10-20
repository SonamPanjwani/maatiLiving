import { notFound, redirect } from "next/navigation";
import ReceiveForm from "@/components/books/ReceiveForm";
import { booksGetPurchase } from "@/src/lib/books/data";

export default async function ReceivePurchasePage({ params, searchParams }) {
  const purchase = await booksGetPurchase(params.id);
  if (!purchase) notFound();
  if (!["draft", "ordered", "partially_received"].includes(purchase.status)) {
    redirect(`/admin/books/purchases/${purchase.id}?error=${encodeURIComponent("Nothing left to receive on this purchase.")}`);
  }
  const items = purchase.items.map((item) => ({
    id: item.id, name: item.product?.name ?? "Product", stock: item.product?.stock ?? 0,
    qtyOrdered: item.qty_ordered, qtyReceived: item.qty_received, unitCostPaise: item.unit_cost_paise,
  }));

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">RECEIVE ITEMS · {purchase.number}</p><h1>What arrived from {purchase.vendor.name}?</h1></div>
      <a className="text-link" href={`/admin/books/purchases/${purchase.id}`}>Back to purchase</a>
    </div>
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}
    <p className="admin-note archived-note">Pre-filled with what's still to come — change any number to what's actually in the box. Stock goes up and each product's cost price updates (average of old stock and this delivery, including its share of shipping and discount).</p>
    <ReceiveForm purchaseId={purchase.id} purchaseNumber={purchase.number} items={items} />
  </>;
}
