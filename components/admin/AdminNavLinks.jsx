"use client";

import { usePathname } from "next/navigation";

// Admin nav links with the current section marked (aria-current). links: [href, label, matchPrefixes?].
// "/admin" (Dashboard) only matches itself; other links also match their sub-pages.
export default function AdminNavLinks({ links }) {
  const pathname = usePathname();
  const isCurrent = (href, prefixes = [href]) => (href === "/admin" ? pathname === "/admin"
    : prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)));
  return <ul>
    {links.map(([href, label, prefixes]) => {
      const current = isCurrent(href, prefixes);
      return <li key={href}><a href={href} className={current ? "is-active" : ""} aria-current={current ? "page" : undefined}>{label}</a></li>;
    })}
  </ul>;
}
