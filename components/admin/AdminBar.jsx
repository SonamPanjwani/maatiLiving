import { ArrowUpRight, Menu, Search, X } from "lucide-react";
import { signOut } from "@/app/admin/actions";
import AdminNavLinks from "@/components/admin/AdminNavLinks";
import { BOOKS_LINKS, MAIN_LINKS, STORE_LINKS } from "@/src/config/admin-nav";
import { siteConfig } from "@/src/config/site";

// Admin header. Desktop: logo · main nav · search · View store ↗ · account menu (email + Sign out).
// Phones (≤ 768px): logo + a menu button that opens grouped links (Store / Books), search, View store and Sign out.
// Both menus are <details>, so they open without JavaScript; links are full page loads, so they close on navigation.
function SearchForm({ id }) {
  return <form action="/admin/search" role="search" className="admin-bar-search">
    <Search size={14} aria-hidden="true" />
    <label htmlFor={id} className="sr-only">Search vendors, purchases, payments, expenses, products and orders</label>
    <input id={id} type="search" name="q" placeholder="Search" enterKeyHint="search" />
  </form>;
}

export default function AdminBar({ email }) {
  return <header className="admin-bar">
    <a className="logo" href="/admin" aria-label="Maati Living admin, dashboard"><img src={siteConfig.logoUrl} alt="Maati Living" /></a>

    <nav className="admin-nav-main" aria-label="Admin"><AdminNavLinks links={MAIN_LINKS} /></nav>
    <SearchForm id="admin-search-desktop" />
    <a className="admin-view-store" href="/" target="_blank" rel="noreferrer">View store <ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
    <details className="admin-account">
      <summary><span className="admin-account-email">{email}</span></summary>
      <div className="admin-account-panel">
        <p><small>Signed in as</small><strong>{email}</strong></p>
        <form action={signOut}><button type="submit" className="admin-signout">Sign out</button></form>
      </div>
    </details>

    <details className="admin-menu">
      <summary aria-label="Menu"><Menu size={20} aria-hidden="true" className="admin-menu-open" /><X size={20} aria-hidden="true" className="admin-menu-close" /><span>Menu</span></summary>
      <div className="admin-menu-panel">
        <SearchForm id="admin-search-mobile" />
        <nav aria-label="Store">
          <p className="admin-menu-group">Store</p>
          <AdminNavLinks links={STORE_LINKS} />
        </nav>
        <nav aria-label="Books">
          <p className="admin-menu-group">Books</p>
          <AdminNavLinks links={BOOKS_LINKS} />
        </nav>
        <div className="admin-menu-foot">
          <a className="admin-view-store" href="/" target="_blank" rel="noreferrer">View store <ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
          <p className="admin-menu-email">{email}</p>
          <form action={signOut}><button type="submit" className="admin-signout">Sign out</button></form>
        </div>
      </div>
    </details>
  </header>;
}
