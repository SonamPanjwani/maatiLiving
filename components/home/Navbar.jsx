"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { siteConfig } from "@/src/config/site";

// solid: charcoal background for pages without a dark hero behind the navbar.
export default function Navbar({ solid = false }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <header className={`navbar ${solid ? "navbar-solid" : ""} ${open ? "nav-open" : ""}`}>
    <Link className="logo" href="/" aria-label="Maati Living home"><img src={siteConfig.logoUrl} alt="Maati Living" /></Link>
    <nav className="desktop-nav" aria-label="Main navigation"><Link href="/shop">Shop</Link><Link href="/#story">Our Story</Link><Link href="/#contact">Contact</Link><Link className="nav-enquire" href="/shop">Enquire <ArrowUpRight size={14} /></Link></nav>
    <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X /> : <Menu />}</button>
    {open && <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/shop" onClick={close}>Shop</Link><Link href="/#story" onClick={close}>Our Story</Link><Link href="/#approach" onClick={close}>Our Approach</Link><Link href="/#contact" onClick={close}>Contact</Link></nav>}
  </header>;
}
