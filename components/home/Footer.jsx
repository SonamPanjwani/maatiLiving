import Link from "next/link";
import { siteConfig } from "@/src/config/site";

export default function Footer() {
  return <footer>
    <div className="footer-brand"><Link className="logo" href="/" aria-label="Maati Living home"><img src={siteConfig.logoUrl} alt="Maati Living" /></Link><p>Thoughtfully chosen.<br />Naturally better.</p></div>
    <div className="footer-links">
      <div><span className="eyebrow">Explore</span><Link href="/shop">Shop</Link><Link href="/about">Our story</Link><Link href="/account">My account</Link></div>
      <div><span className="eyebrow">Help</span><Link href="/shipping-policy">Shipping</Link><Link href="/returns">Returns & refunds</Link><Link href="/contact">Contact</Link></div>
      <div><span className="eyebrow">Say hello</span><a href={siteConfig.instagramUrl}>Instagram</a><a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></div>
    </div>
    <small><span>© {new Date().getFullYear()} Maati Living. Made with thought.</span><span className="footer-legal"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></span></small>
  </footer>;
}
