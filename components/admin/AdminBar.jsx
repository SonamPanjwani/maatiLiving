import { signOut } from "@/app/admin/actions";
import { siteConfig } from "@/src/config/site";

const LINKS = [
  ["/admin", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/products", "Products"],
  ["/admin/categories", "Categories"],
  ["/admin/inventory", "Inventory"],
  ["/admin/customers", "Customers"],
  ["/admin/settings", "Delivery"],
];

export default function AdminBar({ email }) {
  return <header className="admin-bar">
    <a className="logo" href="/admin" aria-label="Maati Living admin"><img src={siteConfig.logoUrl} alt="Maati Living" /></a>
    <nav aria-label="Admin navigation">{LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}<a href="/" target="_blank" rel="noreferrer">View site</a></nav>
    <form action={signOut} className="admin-bar-user"><span>{email}</span><button type="submit">Sign out</button></form>
  </header>;
}
