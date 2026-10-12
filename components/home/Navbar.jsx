"use client";

import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { siteConfig } from "@/src/config/site";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return <header className={`navbar ${open ? "nav-open" : ""}`}>
    <a className="logo" href="#top" aria-label="Maati Living home"><img src={siteConfig.logoUrl} alt="Maati Living" /></a>
    <nav className="desktop-nav" aria-label="Main navigation"><a href="#collection">Shop</a><a href="#story">Our Story</a><a href="#contact">Contact</a><a className="nav-enquire" href="#collection">Enquire <ArrowUpRight size={14} /></a></nav>
    <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X /> : <Menu />}</button>
    {open && <nav className="mobile-nav" aria-label="Mobile navigation"><a href="#collection" onClick={() => setOpen(false)}>Shop</a><a href="#story" onClick={() => setOpen(false)}>Our Story</a><a href="#approach" onClick={() => setOpen(false)}>Our Approach</a><a href="#contact" onClick={() => setOpen(false)}>Contact</a></nav>}
  </header>;
}
