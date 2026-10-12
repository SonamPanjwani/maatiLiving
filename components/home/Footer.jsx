import { siteConfig } from "@/src/config/site";

export default function Footer() {
  return <footer><div className="footer-brand"><a className="logo" href="#top" aria-label="Maati Living home"><img src={siteConfig.logoUrl} alt="Maati Living" /></a><p>Thoughtfully chosen.<br />Naturally better.</p></div><div className="footer-links"><div><span className="eyebrow">Explore</span><a href="#collection">Shop</a><a href="#story">Our Story</a><a href="#approach">Our Approach</a></div><div><span className="eyebrow">Say hello</span><a href={siteConfig.instagramUrl}>Instagram</a><a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></div></div><small>© {new Date().getFullYear()} Maati Living. Made with thought.</small></footer>;
}
