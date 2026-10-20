import { notFound } from "next/navigation";
import VendorForm from "@/components/books/VendorForm";
import { booksGetVendor } from "@/src/lib/books/data";

export default async function EditVendorPage({ params }) {
  const vendor = await booksGetVendor(params.id);
  if (!vendor) notFound();
  return <>
    <div className="admin-heading"><div><p className="eyebrow">BOOKS · EDIT VENDOR</p><h1>{vendor.name}</h1></div></div>
    <VendorForm vendor={vendor} />
  </>;
}
