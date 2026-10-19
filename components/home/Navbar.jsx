"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import CartButton from "@/components/cart/CartButton";
import { siteConfig } from "@/src/config/site";

// solid: charcoal background for pages without a dark hero behind the navbar.
// On the home page it starts transparent over the hero and turns solid once the page scrolls,
// so the cream links never sit on the cream sections below.
export default function Navbar({ solid = false }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (solid) return undefined;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  return <header className={`navbar ${solid || scrolled ? "navbar-solid" : ""} ${open ? "nav-open" : ""}`}>
    <Link className="logo" href="/" aria-label="Maati Living home"><img src={siteConfig.logoUrl} alt="Maati Living" /></Link>
    <nav className="desktop-nav" aria-label="Main navigation"><Link href="/shop">Shop</Link><Link href="/about">Our Story</Link><Link href="/contact">Contact</Link><Link href="/account">My account</Link><CartButton className="nav-enquire nav-cart" /></nav>
    <div className="mobile-actions"><CartButton className="nav-cart nav-cart-mobile" onClick={close} /><button className="menu-toggle" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X /> : <Menu />}</button></div>
    {open && <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/shop" onClick={close}>Shop</Link><Link href="/about" onClick={close}>Our Story</Link><Link href="/contact" onClick={close}>Contact</Link><Link href="/account" onClick={close}>My account</Link></nav>}
  </header>;
}
