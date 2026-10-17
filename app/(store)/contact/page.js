import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BusinessAddress, V } from "@/components/legal/LegalPage";
import { business } from "@/src/config/business";
import { siteConfig } from "@/src/config/site";

export const metadata = { alternates: { canonical: "/contact" }, title: "Contact us", description: "Talk to Maati Living on WhatsApp, by email or on Instagram." };

export default function ContactPage() {
  const officerEmail = business.grievanceOfficer.email ?? siteConfig.email;
  return <section className="contact section">
    <div className="section-heading">
      <div><p className="eyebrow">SAY HELLO</p><h1>We'd love to<br /><em>hear from you.</em></h1></div>
      <p>Questions about a piece, an order, gifting or bulk orders for festivals? Just ask. We usually reply within a day.</p>
    </div>

    <div className="contact-grid">
      <a className="contact-card" href={`https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent("Hi Maati Living!")}`} target="_blank" rel="noreferrer">
        <span className="eyebrow">WHATSAPP</span>
        <strong>The quickest way to reach us</strong>
        <span className="text-link">Start a chat <ArrowUpRight size={14} /></span><span className="sr-only">(opens in a new tab)</span>
      </a>
      <a className="contact-card" href={`mailto:${siteConfig.email}`}>
        <span className="eyebrow">EMAIL</span>
        <strong>{siteConfig.email}</strong>
        <span className="text-link">Write to us <ArrowUpRight size={14} /></span>
      </a>
      <a className="contact-card" href={siteConfig.instagramUrl} target="_blank" rel="noreferrer">
        <span className="eyebrow">INSTAGRAM</span>
        <strong>{siteConfig.instagramHandle}</strong>
        <span className="text-link">See what's new <ArrowUpRight size={14} /></span><span className="sr-only">(opens in a new tab)</span>
      </a>
    </div>

    <div className="contact-details">
      <div>
        <h2 className="eyebrow">REGISTERED ADDRESS</h2>
        <address><BusinessAddress /></address>
        {business.gstin && <p>GSTIN {business.gstin}</p>}
      </div>
      <div>
        <h2 className="eyebrow">GRIEVANCE OFFICER</h2>
        <p><V>{business.grievanceOfficer.name}</V><br /><a href={`mailto:${officerEmail}`}>{officerEmail}</a><br />We acknowledge complaints within 48 hours.</p>
      </div>
      <div>
        <h2 className="eyebrow">ABOUT YOUR ORDER</h2>
        <p>Track it in <Link href="/account">My account</Link> or with the link from your confirmation. See also <Link href="/shipping-policy">shipping</Link> and <Link href="/returns">returns & refunds</Link>.</p>
      </div>
    </div>
  </section>;
}
