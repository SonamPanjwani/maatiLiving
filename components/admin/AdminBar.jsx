import { signOut } from "@/app/admin/actions";
import { siteConfig } from "@/src/config/site";

export default function AdminBar({ email }) {
  return <header className="admin-bar">
    <a className="logo" href="/admin/products" aria-label="Maati Living admin"><img src={siteConfig.logoUrl} alt="Maati Living" /></a>
    <nav aria-label="Admin navigation"><a href="/admin/orders">Orders</a><a href="/admin/products">Products</a><a href="/admin/categories">Categories</a><a href="/" target="_blank" rel="noreferrer">View site</a></nav>
    <form action={signOut} className="admin-bar-user"><span>{email}</span><button type="submit">Sign out</button></form>
  </header>;
}
