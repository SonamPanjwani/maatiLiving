import { adminSearch } from "@/src/lib/admin-search";
import { formatDate, formatPrice } from "@/src/lib/format";
import { adminStatusLabel } from "@/src/lib/order-status";

export const metadata = { title: "Search", robots: { index: false } };

function Group({ title, items, render }) {
  if (!items.length) return null;
  return <section className="search-group">
    <h2 className="eyebrow">{title} <small>{items.length}</small></h2>
    <ul>{items.map(render)}</ul>
  </section>;
}

const Item = ({ href, title, detail, amount, voided }) => <li className={voided ? "is-void" : ""}>
  <a href={href}><strong>{title}</strong>{detail && <small>{detail}</small>}</a>
  {amount != null && <span className="num">{formatPrice(amount)}</span>}
</li>;

export default async function SearchPage({ searchParams }) {
  const q = String(searchParams?.q ?? "");
  const results = await adminSearch(q);

  return <>
    <div className="admin-heading"><div><p className="eyebrow">ADMIN</p><h1>Search</h1></div></div>
    <form className="admin-filters" action="/admin/search" role="search">
      <label className="field" htmlFor="search-q"><span>Vendors, PO or bill number, payments, expenses, products, orders</span>
        <input id="search-q" type="search" name="q" defaultValue={q} placeholder="e.g. PO-1004, Molela, ML1023, kraft" enterKeyHint="search" autoFocus={!q} /></label>
      <button type="submit" className="button button-dark">Search</button>
    </form>

    {!results
      ? <p className="admin-note">Type at least 2 letters or numbers.</p>
      : results.count === 0
        ? <div className="books-empty"><p>Nothing matches “{results.term}”.</p></div>
        : <div className="search-results">
            <Group title="VENDORS" items={results.vendors} render={(v) => <Item key={v.id} href={`/admin/books/vendors/${v.id}`} title={v.name} detail={[v.city, v.phone, v.status === "archived" && "archived"].filter(Boolean).join(" · ")} />} />
            <Group title="PURCHASES" items={results.purchases} render={(p) => <Item key={p.id} href={`/admin/books/purchases/${p.id}`} title={p.number} detail={[p.status === "cancelled" && "Cancelled", p.vendor?.name, p.bill_number && `bill ${p.bill_number}`, formatDate(p.order_date)].filter(Boolean).join(" · ")} amount={p.total_paise} voided={p.status === "cancelled"} />} />
            <Group title="PAYMENTS" items={results.payments} render={(p) => <Item key={p.id} href={`/admin/books/payments/${p.id}`} title={p.number} detail={[p.status === "voided" && "Voided", p.vendor?.name, p.reference, formatDate(p.paid_on)].filter(Boolean).join(" · ")} amount={p.amount_paise} voided={p.status === "voided"} />} />
            <Group title="EXPENSES" items={results.expenses} render={(e) => <Item key={e.id} href={`/admin/books/expenses/${e.id}`} title={e.description || e.category?.name} detail={[e.status === "voided" && "Voided", e.number, e.category?.name, formatDate(e.spent_on)].filter(Boolean).join(" · ")} amount={e.amount_paise} voided={e.status === "voided"} />} />
            <Group title="PRODUCTS" items={results.products} render={(p) => <Item key={p.id} href={`/admin/inventory/${p.id}`} title={p.name} detail={[p.sku, `${p.stock} in stock`].filter(Boolean).join(" · ")} amount={p.price_paise} />} />
            <Group title="ORDERS" items={results.orders} render={(o) => <Item key={o.id} href={`/admin/orders/${o.id}`} title={o.order_number} detail={[o.customer_name, adminStatusLabel(o)].filter(Boolean).join(" · ")} amount={o.total_paise} />} />
          </div>}
  </>;
}
