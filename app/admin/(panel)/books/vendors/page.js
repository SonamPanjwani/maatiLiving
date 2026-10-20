import { Plus } from "lucide-react";
import { booksGetVendors } from "@/src/lib/books/data";
import { formatPrice } from "@/src/lib/format";

export default async function VendorsPage({ searchParams }) {
  const status = searchParams?.status === "archived" ? "archived" : "active";
  const sort = searchParams?.sort === "balance" ? "balance" : "name";
  const vendors = await booksGetVendors({ q: searchParams?.q, status, sort });
  const link = (params) => `/admin/books/vendors?${new URLSearchParams({ ...(searchParams?.q ? { q: searchParams.q } : {}), status, sort, ...params })}`;

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">BOOKS</p><h1>Vendors</h1></div>
      <a className="button button-dark" href="/admin/books/vendors/new"><Plus size={14} /> Add vendor</a>
    </div>

    <form className="admin-filters" action="/admin/books/vendors">
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="sort" value={sort} />
      <label className="field" htmlFor="vendor-q"><span>Search</span><input id="vendor-q" name="q" defaultValue={searchParams?.q ?? ""} placeholder="Name, phone, city or what they supply" /></label>
      <button type="submit" className="button button-dark">Search</button>
      {searchParams?.q && <a className="text-link" href={`/admin/books/vendors?status=${status}`}>Clear</a>}
    </form>

    <nav className="category-nav admin-tabs" aria-label="Vendor filters"><ul>
      <li><a href={link({ status: "active" })} className={status === "active" ? "is-active" : ""} aria-current={status === "active" ? "page" : undefined}>Active</a></li>
      <li><a href={link({ status: "archived" })} className={status === "archived" ? "is-active" : ""} aria-current={status === "archived" ? "page" : undefined}>Archived</a></li>
      <li className="tabs-spacer" aria-hidden="true" />
      <li><a href={link({ sort: "name" })} className={sort === "name" ? "is-active" : ""}>Sort: name</a></li>
      <li><a href={link({ sort: "balance" })} className={sort === "balance" ? "is-active" : ""}>Sort: balance due</a></li>
    </ul></nav>

    {vendors.length === 0
      ? <div className="books-empty">
          <p>{searchParams?.q ? "No vendors match that search." : status === "archived" ? "No archived vendors." : "No vendors yet. Add the potters, shell artisans and suppliers you buy from — then purchases and payments can be tracked against them."}</p>
          {!searchParams?.q && status === "active" && <a className="button button-dark" href="/admin/books/vendors/new"><Plus size={14} /> Add your first vendor</a>}
        </div>
      : <table className="admin-table table-cards">
          <thead><tr><th>Vendor</th><th>City</th><th>Supplies</th><th className="num">Balance due</th><th>Last purchase</th></tr></thead>
          <tbody>
            {vendors.map((vendor) => <tr key={vendor.id}>
              <td data-label="Vendor"><a href={`/admin/books/vendors/${vendor.id}`}><strong>{vendor.name}</strong></a>{vendor.contact_person && <small>{vendor.contact_person}</small>}</td>
              <td data-label="City">{[vendor.city, vendor.state].filter(Boolean).join(", ") || <span className="muted">—</span>}</td>
              <td data-label="Supplies">{vendor.supplies || <span className="muted">—</span>}</td>
              <td data-label="Balance due" className={`num ${vendor.balancePaise > 0 ? "admin-warn" : ""}`}>{vendor.balancePaise > 0 ? formatPrice(vendor.balancePaise) : vendor.balancePaise < 0 ? <>{formatPrice(-vendor.balancePaise)} <small>advance</small></> : "—"}</td>
              <td data-label="Last purchase"><span className="muted">—</span></td>
            </tr>)}
          </tbody>
        </table>}
  </>;
}
