"use client";

import { useEffect } from "react";
import Link from "next/link";
import FloatingWhatsApp from "@/components/common/FloatingWhatsApp";
import Footer from "@/components/home/Footer";
import Navbar from "@/components/home/Navbar";
import { siteConfig } from "@/src/config/site";

// Shown when a page throws (e.g. the database is briefly unreachable). Replaces everything under the
// root layout, so it brings its own navbar and footer to keep the visitor oriented.
export default function Error({ error, reset }) {
  useEffect(() => { console.error(error); }, [error]);
  return <>
    <Navbar solid />
    <main id="content" className="store-main">
      <section className="status-page section">
        <p className="eyebrow">SOMETHING WENT WRONG</p>
        <h1>Sorry, that<br /><em>didn't load.</em></h1>
        <p>It's probably a brief hiccup. Try again in a moment. If it keeps happening, message us on <a href={`https://wa.me/${siteConfig.whatsappNumber}`}>WhatsApp</a>.</p>
        <div className="status-actions">
          <button type="button" className="button button-dark" onClick={() => reset()}>Try again</button>
          <Link className="text-link" href="/">Back home</Link>
        </div>
      </section>
    </main>
    <Footer />
    <FloatingWhatsApp />
  </>;
}
