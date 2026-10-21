"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { BOOKS_LINKS } from "@/src/config/admin-nav";

// Sub-navigation for the Books area (same list as the Books group in the admin menu). One row: on phones it
// scrolls sideways, and the current section is scrolled into view when the page opens.
export default function BooksNav() {
  const pathname = usePathname();
  const current = useRef(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return <nav className="category-nav books-nav" aria-label="Books"><ul>
    <li className="books-nav-label" aria-hidden="true">Books</li>
    {BOOKS_LINKS.map(([href, label]) => {
      const isCurrent = pathname === href || pathname.startsWith(`${href}/`);
      return <li key={href}><a href={href} ref={isCurrent ? current : undefined} className={isCurrent ? "is-active" : ""} aria-current={isCurrent ? "page" : undefined}>{label}</a></li>;
    })}
  </ul></nav>;
}
