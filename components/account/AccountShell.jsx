import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { signOutCustomer } from "@/app/(store)/account/actions";

const LINKS = [
  { href: "/account", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
];

// Page frame for signed-in account pages: heading + side navigation.
// isAdmin: the shop owner browsing their own account gets a way back to the dashboard.
export default function AccountShell({ active, name, title, isAdmin = false, children }) {
  return <section className="account section">
    {isAdmin && <a className="admin-return" href="/admin">You're signed in as admin. <strong>Open admin dashboard <ArrowUpRight size={14} /></strong></a>}
    <div className="section-heading"><div><p className="eyebrow">MY ACCOUNT{name ? ` · ${name}` : ""}</p><h1>{title}</h1></div></div>
    <div className="account-layout">
      <nav className="account-nav" aria-label="Account">
        {isAdmin && <a href="/admin" className="account-nav-admin">Admin dashboard</a>}
        {LINKS.map((link) => <Link key={link.href} href={link.href} className={link.href === active ? "is-active" : ""} aria-current={link.href === active ? "page" : undefined}>{link.label}</Link>)}
        <form action={signOutCustomer}><button type="submit">Sign out</button></form>
      </nav>
      <div className="account-content">{children}</div>
    </div>
  </section>;
}
