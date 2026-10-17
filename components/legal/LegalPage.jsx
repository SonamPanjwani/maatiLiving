import Link from "next/link";
import { business, isTodo, listTodos } from "@/src/config/business";

// Renders a config value; unfilled TODOs show as a highlighted placeholder rather than disappearing.
export function V({ children }) {
  return isTodo(children) ? <mark className="legal-todo">{children.replace(/^TODO:\s*/, "")}</mark> : <>{children}</>;
}

export function BusinessAddress() {
  const { address } = business;
  return <><V>{business.legalName}</V> (trading as {business.tradeName}), <V>{address.line1}</V>,<V>{address.city}</V>, <V>{address.state}</V> <V>{address.pincode}</V>, India</>;
}

const POLICY_LINKS = [
  ["/shipping-policy", "Shipping"],
  ["/returns", "Returns & refunds"],
  ["/terms", "Terms"],
  ["/privacy", "Privacy"],
];

// Frame for policy pages: heading, draft notice while details are missing, readable column, sibling links.
export default function LegalPage({ eyebrow, title, intro, path, children }) {
  const draft = listTodos().length > 0;
  return <section className="legal section">
    <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{intro && <p>{intro}</p>}</div>
    {draft && <p className="legal-draft" role="note">Draft: highlighted details are still being confirmed.</p>}
    <div className="legal-layout">
      <nav className="legal-nav" aria-label="Policies">
        {POLICY_LINKS.map(([href, label]) => <Link key={href} href={href} className={href === path ? "is-active" : ""} aria-current={href === path ? "page" : undefined}>{label}</Link>)}
        <Link href="/contact">Contact</Link>
      </nav>
      <div className="legal-body">
        {children}
        <p className="legal-updated">Effective from <V>{business.policies.effectiveDate}</V>.</p>
      </div>
    </div>
  </section>;
}
