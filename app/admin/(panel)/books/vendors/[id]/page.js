import { notFound } from "next/navigation";
import { MessageCircle, Pencil, Phone } from "lucide-react";
import { archiveVendor, linkVendorProduct, restoreVendor, setPreferredVendor, unlinkVendorProduct, updateVendorProduct } from "@/app/admin/(panel)/books/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import SubmitButton from "@/components/admin/SubmitButton";
import { CopyUpiId } from "@/components/orders/UpiReferenceForm";
import { paiseToRupeeInput } from "@/src/lib/books/money";
import { booksGetLinkableProducts, booksGetVendor } from "@/src/lib/books/data";
import { formatPrice } from "@/src/lib/format";

const SAVED = {
  created: "Vendor added.", updated: "Vendor saved.", archived: "Vendor archived.", restored: "Vendor restored.",
  linked: "Product linked.", preferred: "Preferred vendor updated.", "link-updated": "Saved.", unlinked: "Product unlinked.",
};
const TABS = [["products", "Products supplied"], ["details", "Details & notes"]];

export default async function VendorPage({ params, searchParams }) {
  const vendor = await booksGetVendor(params.id);
  if (!vendor) notFound();
  const tab = TABS.some(([key]) => key === searchParams?.tab) ? searchParams.tab : "products";
  const linkable = tab === "products" ? await booksGetLinkableProducts(vendor.id) : [];
  const archived = vendor.status === "archived";

  return <>
    <div className="admin-heading vendor-heading">
      <div>
        <p className="eyebrow">VENDOR{archived ? " · ARCHIVED" : ""}</p>
        <h1>{vendor.name}</h1>
        <p className="admin-note">{[vendor.contact_person, [vendor.city, vendor.state].filter(Boolean).join(", "), vendor.supplies].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="vendor-actions">
        {vendor.phone && <a className="stock-save" href={`tel:+91${vendor.phone}`}><Phone size={14} /> Call</a>}
        {vendor.whatsapp && <a className="stock-save" href={`https://wa.me/91${vendor.whatsapp}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}
        {vendor.upi_id && <span className="vendor-upi"><code>{vendor.upi_id}</code><CopyUpiId upiId={vendor.upi_id} /></span>}
        <a className="stock-save" href={`/admin/books/vendors/${vendor.id}/edit`}><Pencil size={14} /> Edit</a>
      </div>
    </div>
    {searchParams?.saved && <p className="admin-success" role="status">{SAVED[searchParams.saved] ?? "Saved."}</p>}
    {searchParams?.error && <p className="admin-error" role="alert">{searchParams.error}</p>}
    {archived && <p className="admin-note archived-note">Archived{vendor.archived_reason ? `: ${vendor.archived_reason}` : ""}. It stays in your records; restore it to buy from them again.</p>}

    <section className="kpi-row kpi-row-4" aria-label="Vendor figures">
      <div className="kpi"><span className="kpi-label">Balance due</span><span className="kpi-value">{formatPrice(Math.max(vendor.balancePaise, 0))}</span><span className="kpi-note">{vendor.balancePaise < 0 ? `${formatPrice(-vendor.balancePaise)} advance with them` : "Opening balance only, for now"}</span></div>
      <div className="kpi"><span className="kpi-label">Products supplied</span><span className="kpi-value">{vendor.products.length}</span><span className="kpi-note">{vendor.products.filter((p) => p.is_preferred).length} as preferred vendor</span></div>
      <div className="kpi"><span className="kpi-label">Payment terms</span><span className="kpi-value">{vendor.payment_terms_days ? `${vendor.payment_terms_days} days` : "On receipt"}</span><span className="kpi-note">From the bill date</span></div>
      <div className="kpi"><span className="kpi-label">Rating</span><span className="kpi-value">{vendor.rating ? <span aria-label={`${vendor.rating} of 5`}>{"★".repeat(vendor.rating)}</span> : "—"}</span><span className="kpi-note">{vendor.gstin ? `GSTIN ${vendor.gstin}` : "No GSTIN"}</span></div>
    </section>

    <nav className="category-nav admin-tabs" aria-label="Vendor sections"><ul>
      {TABS.map(([key, label]) => <li key={key}><a href={`/admin/books/vendors/${vendor.id}?tab=${key}`} className={tab === key ? "is-active" : ""} aria-current={tab === key ? "page" : undefined}>{label}</a></li>)}
    </ul></nav>

    {tab === "products" && <div className="admin-split">
      <section>
        {vendor.products.length === 0
          ? <div className="books-empty"><p>No products linked yet. Link what {vendor.name} supplies so purchases can pre-fill their last cost.</p></div>
          : <table className="admin-table table-cards">
              <thead><tr><th>Product</th><th>Their SKU / last cost</th><th>Preferred</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{vendor.products.map((link) => <tr key={link.id}>
                <td data-label="Product"><a href={`/admin/inventory/${link.product_id}`}><strong>{link.products?.name}</strong></a><small>{link.products?.stock} in stock · sells at {formatPrice(link.products?.price_paise ?? 0)}</small></td>
                <td data-label="SKU / cost">
                  <form action={updateVendorProduct} className="inline-form">
                    <input type="hidden" name="vendorId" value={vendor.id} /><input type="hidden" name="linkId" value={link.id} />
                    <label><small>Their SKU</small><input name="vendorSku" defaultValue={link.vendor_sku ?? ""} aria-label={`Vendor SKU for ${link.products?.name}`} /></label>
                    <label><small>Last cost (₹)</small><input name="lastCost" inputMode="decimal" defaultValue={paiseToRupeeInput(link.last_cost_paise)} aria-label={`Last cost for ${link.products?.name}`} /></label>
                    <SubmitButton className="stock-save" pendingLabel="…">Save</SubmitButton>
                  </form>
                </td>
                <td data-label="Preferred">{link.is_preferred
                  ? <span className="badge">Preferred</span>
                  : <form action={setPreferredVendor}><input type="hidden" name="vendorId" value={vendor.id} /><input type="hidden" name="productId" value={link.product_id} /><ConfirmSubmit className="text-link" message={`Make ${vendor.name} the preferred vendor for ${link.products?.name}? This replaces the current preferred vendor.`}>Make preferred</ConfirmSubmit></form>}</td>
                <td className="table-action"><form action={unlinkVendorProduct}><input type="hidden" name="vendorId" value={vendor.id} /><input type="hidden" name="linkId" value={link.id} /><ConfirmSubmit className="text-link" message={`Unlink ${link.products?.name} from ${vendor.name}? Purchase history isn't affected.`}>Unlink</ConfirmSubmit></form></td>
              </tr>)}</tbody>
            </table>}
      </section>
      <aside className="admin-panel books-side">
        <form action={linkVendorProduct} className="admin-form">
          <h2 className="eyebrow">LINK A PRODUCT</h2>
          <input type="hidden" name="vendorId" value={vendor.id} />
          {linkable.length === 0
            ? <p className="admin-note">Every product is already linked to this vendor.</p>
            : <>
                <label className="field" htmlFor="link-product"><span>Product</span>
                  <select id="link-product" name="productId" required defaultValue="">
                    <option value="" disabled>Choose a product</option>
                    {linkable.map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` (${product.sku})` : ""}</option>)}
                  </select>
                </label>
                <label className="field" htmlFor="link-sku"><span>Their SKU / code <small>optional</small></span><input id="link-sku" name="vendorSku" /></label>
                <label className="field" htmlFor="link-cost"><span>Their price per piece (₹) <small>optional</small></span><input id="link-cost" name="lastCost" inputMode="decimal" /></label>
                <div className="field-checks"><label><input type="checkbox" name="preferred" /> Preferred vendor for this product</label></div>
                <SubmitButton>Link product</SubmitButton>
              </>}
        </form>
      </aside>
    </div>}

    {tab === "details" && <div className="admin-split">
      <section>
        <dl className="vendor-details">
          {[
            ["Contact person", vendor.contact_person], ["Phone", vendor.phone && `+91 ${vendor.phone}`], ["WhatsApp", vendor.whatsapp && `+91 ${vendor.whatsapp}`],
            ["Email", vendor.email], ["Address", [vendor.address, vendor.city, vendor.state].filter(Boolean).join(", ")],
            ["UPI ID", vendor.upi_id], ["Bank", [vendor.bank_account_name, vendor.bank_account_number, vendor.bank_ifsc].filter(Boolean).join(" · ")],
            ["GSTIN", vendor.gstin], ["PAN", vendor.pan], ["Opening balance", formatPrice(vendor.opening_balance_paise)], ["Notes", vendor.notes],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="muted">—</span>}</dd></div>)}
        </dl>
      </section>
      <aside className="admin-panel books-side">
        {archived
          ? <form action={restoreVendor} className="admin-form"><input type="hidden" name="id" value={vendor.id} /><h2 className="eyebrow">RESTORE</h2><p className="admin-note">Make this vendor active again.</p><SubmitButton>Restore vendor</SubmitButton></form>
          : <form action={archiveVendor} className="admin-form">
              <input type="hidden" name="id" value={vendor.id} />
              <h2 className="eyebrow">ARCHIVE</h2>
              <p className="admin-note">Vendors are never deleted — archiving hides them from lists but keeps all history.</p>
              <label className="field" htmlFor="archive-reason"><span>Reason</span><input id="archive-reason" name="reason" required minLength={3} placeholder="e.g. stopped supplying" /></label>
              <ConfirmSubmit message={`Archive ${vendor.name}? You can restore them later.`}>Archive vendor</ConfirmSubmit>
            </form>}
      </aside>
    </div>}
  </>;
}
