import PaymentForm from "@/components/books/PaymentForm";
import { booksGetPaymentFormData } from "@/src/lib/books/data";
import { todayInIndia } from "@/src/lib/format";

export default async function NewPaymentPage({ searchParams }) {
  const vendors = await booksGetPaymentFormData();
  const defaultVendorId = vendors.some((vendor) => vendor.id === searchParams?.vendor) ? searchParams.vendor : "";
  const from = searchParams?.purchase ? `/admin/books/purchases/${encodeURIComponent(searchParams.purchase)}` : defaultVendorId ? `/admin/books/vendors/${defaultVendorId}?tab=payments` : "/admin/books/payments";

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS · PAYMENTS</p><h1>Record payment</h1></div>
      <a className="text-link" href="/admin/books/payments">All payments</a>
    </div>
    {vendors.length === 0
      ? <div className="books-empty"><p>Add a vendor first — every payment is to someone.</p><a className="button button-dark" href="/admin/books/vendors/new">Add a vendor</a></div>
      : <PaymentForm vendors={vendors} defaultVendorId={defaultVendorId} defaultPurchaseId={searchParams?.purchase ?? ""} today={todayInIndia()} cancelHref={from} />}
  </>;
}
