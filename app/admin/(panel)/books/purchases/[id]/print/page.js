import { notFound } from "next/navigation";
import PrintButton from "@/components/books/PrintButton";
import { business } from "@/src/config/business";
import { siteConfig } from "@/src/config/site";
import { booksGetPurchase } from "@/src/lib/books/data";
import { PURCHASE_STATUS } from "@/src/lib/books/purchases";
import { formatDate, formatPrice } from "@/src/lib/format";

// Printable purchase order (print → "Save as PDF"). ?prices=0 leaves prices out.
export default async function PrintPurchasePage({ params, searchParams }) {
  const purchase = await booksGetPurchase(params.id);
  if (!purchase) notFound();
  const withPrices = searchParams?.prices !== "0";
  const { vendor, items } = purchase;
  const ours = [business.address.line1, `${business.address.city}, ${business.address.state} ${business.address.pincode}`];
  const theirs = [vendor.address, [vendor.city, vendor.state].filter(Boolean).join(", ")].filter(Boolean);

  return <>
    <div className="print-toolbar no-print">
      <a className="text-link" href={`/admin/books/purchases/${purchase.id}`}>Back to purchase</a>
      <a className="text-link" href={`?prices=${withPrices ? "0" : "1"}`}>{withPrices ? "Hide prices" : "Show prices"}</a>
      <PrintButton />
    </div>

    <article className="print-doc">
      <header className="print-head">
        <div>
          <p className="print-brand">{siteConfig.name}</p>
          {ours.map((line) => <p key={line}>{line}</p>)}
          {business.gstin && <p>GSTIN {business.gstin}</p>}
        </div>
        <div className="print-meta">
          <h1>Purchase order</h1>
          <p><strong>{purchase.number}</strong></p>
          <p>Date: {formatDate(purchase.order_date)}</p>
          {purchase.expected_date && <p>Needed by: {formatDate(purchase.expected_date)}</p>}
          {purchase.status === "cancelled" && <p className="admin-warn">{PURCHASE_STATUS.cancelled.toUpperCase()}</p>}
        </div>
      </header>

      <section className="print-party">
        <h2 className="eyebrow">TO</h2>
        <p><strong>{vendor.name}</strong>{vendor.contact_person ? ` · ${vendor.contact_person}` : ""}</p>
        {theirs.map((line) => <p key={line}>{line}</p>)}
        {vendor.phone && <p>+91 {vendor.phone}</p>}
        {vendor.gstin && <p>GSTIN {vendor.gstin}</p>}
      </section>

      <table className="admin-table print-table">
        <thead><tr><th>#</th><th>Item</th><th className="num">Qty</th>{withPrices && <><th className="num">Rate</th><th className="num">Amount</th></>}</tr></thead>
        <tbody>{items.map((item, index) => <tr key={item.id}>
          <td>{index + 1}</td>
          <td>{item.product?.name}{item.product?.sku && <small>{item.product.sku}</small>}</td>
          <td className="num">{Math.max(item.qty_ordered, item.qty_received)}</td>
          {withPrices && <><td className="num">{formatPrice(item.unit_cost_paise)}</td><td className="num">{formatPrice(item.line_total_paise)}</td></>}
        </tr>)}</tbody>
      </table>

      {withPrices && <dl className="purchase-totals">
        <div><dt>Items</dt><dd>{formatPrice(purchase.subtotal_paise)}</dd></div>
        {purchase.discount_paise > 0 && <div><dt>Discount</dt><dd>−{formatPrice(purchase.discount_paise)}</dd></div>}
        {purchase.shipping_paise > 0 && <div><dt>Shipping</dt><dd>{formatPrice(purchase.shipping_paise)}</dd></div>}
        {purchase.tax_paise > 0 && <div><dt>Tax</dt><dd>{formatPrice(purchase.tax_paise)}</dd></div>}
        <div className="purchase-total"><dt>Total</dt><dd>{formatPrice(purchase.total_paise)}</dd></div>
      </dl>}

      <footer className="print-foot">
        <p>Please confirm the order and expected delivery date. Thank you.</p>
        <p>{siteConfig.name}{siteConfig.email.endsWith("example.com") ? "" : ` · ${siteConfig.email}`}</p>
      </footer>
    </article>
  </>;
}
