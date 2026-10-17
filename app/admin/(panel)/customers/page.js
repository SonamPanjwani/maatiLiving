import { adminGetCustomers } from "@/src/lib/admin-catalog";
import { formatPrice } from "@/src/lib/format";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function CustomersPage({ searchParams }) {
  const customers = await adminGetCustomers({ q: searchParams?.q });

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow">SALES</p><h1>Customers</h1></div>
      <p className="admin-note">Everyone who has paid for an order, including guests.</p>
    </div>
    <form className="admin-filters" action="/admin/customers">
      <label className="field"><span>Search</span><input name="q" defaultValue={searchParams?.q ?? ""} placeholder="Name, email, phone or city" /></label>
      <button type="submit" className="button button-dark">Search</button>
      {searchParams?.q && <a className="text-link" href="/admin/customers">Clear</a>}
    </form>

    {customers.length === 0
      ? <p className="admin-empty">{searchParams?.q ? "No customers match that search." : "No customers yet."}</p>
      : <table className="admin-table">
          <thead><tr><th>Customer</th><th>Contact</th><th>Location</th><th className="num">Orders</th><th className="num">Spent</th><th>Last order</th></tr></thead>
          <tbody>
            {customers.map((customer) => <tr key={customer.email}>
              <td><a href={`/admin/orders?tab=all&q=${encodeURIComponent(customer.email)}`}><strong>{customer.name}</strong></a><small>{customer.hasAccount ? "Has an account" : "Guest"}</small></td>
              <td><a href={`mailto:${customer.email}`}>{customer.email}</a><small><a href={`https://wa.me/91${customer.phone}`} target="_blank" rel="noreferrer">+91 {customer.phone}</a></small></td>
              <td>{customer.city}<small>{customer.state}</small></td>
              <td className="num">{customer.orders}</td>
              <td className="num">{formatPrice(customer.spentPaise)}</td>
              <td>{dateFormat.format(new Date(customer.lastOrderAt))}</td>
            </tr>)}
          </tbody>
        </table>}
  </>;
}
