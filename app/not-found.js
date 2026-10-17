import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import FloatingWhatsApp from "@/components/common/FloatingWhatsApp";
import Footer from "@/components/home/Footer";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return <>
    <Navbar solid />
    <main id="content" className="store-main">
      <section className="status-page section">
        <p className="eyebrow">404 · PAGE NOT FOUND</p>
        <h1>This page has<br /><em>wandered off.</em></h1>
        <p>It may have moved, or the piece you're looking for is no longer in the shop.</p>
        <div className="status-actions">
          <Link className="button button-dark" href="/shop">Explore the shop <ArrowUpRight size={16} /></Link>
          <Link className="text-link" href="/">Back home</Link>
        </div>
      </section>
    </main>
    <Footer />
    <FloatingWhatsApp />
  </>;
}
