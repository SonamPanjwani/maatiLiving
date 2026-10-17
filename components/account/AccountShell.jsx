import Link from "next/link";
import { signOutCustomer } from "@/app/(store)/account/actions";

const LINKS = [
  { href: "/account", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
];

// Page frame for signed-in account pages: heading + side navigation.
export default function AccountShell({ active, name, title, children }) {
  return <section className="account section">
    <div className="section-heading"><div><p className="eyebrow">MY ACCOUNT{name ? ` · ${name}` : ""}</p><h1>{title}</h1></div></div>
    <div className="account-layout">
      <nav className="account-nav" aria-label="Account">
        {LINKS.map((link) => <Link key={link.href} href={link.href} className={link.href === active ? "is-active" : ""} aria-current={link.href === active ? "page" : undefined}>{link.label}</Link>)}
        <form action={signOutCustomer}><button type="submit">Sign out</button></form>
      </nav>
      <div className="account-content">{children}</div>
    </div>
  </section>;
}
