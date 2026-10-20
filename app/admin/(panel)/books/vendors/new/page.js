import VendorForm from "@/components/books/VendorForm";

export default function NewVendorPage() {
  return <>
    <div className="admin-heading"><div><p className="eyebrow">BOOKS · VENDORS</p><h1>Add <em>vendor</em></h1></div></div>
    <VendorForm />
  </>;
}
