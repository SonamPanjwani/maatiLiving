"use client";

import { usePathname } from "next/navigation";

// Sub-navigation for the Books area. Sections are added as each phase ships.
const SECTIONS = [
  ["/admin/books/vendors", "Vendors"],
  ["/admin/books/purchases", "Purchases"],
  ["/admin/inventory", "Inventory"],
];

export default function BooksNav() {
  const pathname = usePathname();
  return <nav className="category-nav books-nav" aria-label="Books"><ul>
    <li className="books-nav-label">Books</li>
    {SECTIONS.map(([href, label]) => {
      const current = pathname === href || pathname.startsWith(`${href}/`);
      return <li key={href}><a href={href} className={current ? "is-active" : ""} aria-current={current ? "page" : undefined}>{label}</a></li>;
    })}
  </ul></nav>;
}
