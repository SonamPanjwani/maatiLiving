"use client";

import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { CldImage } from "next-cloudinary";
import { products } from "@/src/data/products";
import { getWhatsAppUrl, siteConfig } from "@/src/config/site";
import { isCloudinaryConfigured } from "@/src/config/cloudinary";
import Hero from "@/components/home/Hero";

const beliefs = [
  ["01", "Thoughtful Materials", "Natural materials and simple things that don't need a lot of explaining."],
  ["02", "Made with Purpose", "We look for products made by people who care about what they make — especially Indian artisans and small makers."],
  ["03", "Less Waste", "We're always looking for simple swaps that can help us use less plastic and waste less."],
  ["04", "Made for Everyday Life", "Sustainable doesn't help much if it just sits on a shelf. We look for things you'll actually use."],
  ["05", "Rooted in India", "India has so much to offer — from traditional crafts to natural materials and age-old ways of making things."],
];

function TextilePlaceholder({ variant = "indigo", label = "Image placeholder" }) {
  return <div className={`textile textile-${variant}`} role="img" aria-label={`${label} — replace with final photography`}><span>TEXTILE STUDY / REPLACE WITH FINAL IMAGE</span></div>;
}

function WhatsAppLink({ productName, children = "ENQUIRE ON WHATSAPP", className = "" }) {
  return <a className={`whatsapp-link ${className}`} href={getWhatsAppUrl(productName)} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={15} /></a>;
}

function ProductCard({ product, index }) {
  return <article className="product-card">
    <div className="product-image-wrap">{isCloudinaryConfigured && product.images[0].publicId ? <CldImage src={product.images[0].publicId} alt={product.images[0].alt} fill sizes="(max-width: 700px) 84vw, 30vw" crop="fill" gravity="auto" format="auto" quality="auto" /> : <TextilePlaceholder variant={["indigo", "rust", "moss"][index]} label={product.images[0].alt} />}<span className="product-index">0{index + 1}</span></div>
    <div className="product-meta"><span className="eyebrow">{product.category}</span><h3>{product.name}</h3><span className="price">{product.price}</span><p>{product.sourcingNote}</p><WhatsAppLink productName={product.name} /></div>
  </article>;
}

function Navbar() {
  const [open, setOpen] = useState(false);
  return <header className={`navbar ${open ? "nav-open" : ""}`}>
    <a className="logo" href="#top" aria-label="Maati Living home"><img src={siteConfig.logoUrl} alt="Maati Living" /></a>
    <nav className="desktop-nav" aria-label="Main navigation"><a href="#collection">Shop</a><a href="#story">Our Story</a><a href="#contact">Contact</a><a className="nav-enquire" href="#collection">Enquire <ArrowUpRight size={14} /></a></nav>
    <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X /> : <Menu />}</button>
    {open && <nav className="mobile-nav" aria-label="Mobile navigation"><a href="#collection" onClick={() => setOpen(false)}>Shop</a><a href="#story" onClick={() => setOpen(false)}>Our Story</a><a href="#approach" onClick={() => setOpen(false)}>Our Approach</a><a href="#contact" onClick={() => setOpen(false)}>Contact</a></nav>}
  </header>;
}

export default function Home() {
  return <main id="top">
    <Navbar />
    <Hero />

    <section className="intro section-grid"><div><p className="eyebrow">A LITTLE MORE THOUGHT</p><h2>Better choices don't have to be complicated.</h2></div><div className="body-copy"><p>We started Maati Living with a simple thought — what if making better choices for our everyday lives was a little easier?</p><p>We look for things that are natural, useful, beautifully made and kinder to the world around us.</p><p>No pressure to live perfectly. Just small, better choices.</p><a className="text-link" href="#story">Discover our story <ArrowUpRight size={15} /></a></div></section>

    <section id="collection" className="collection section"><div className="section-heading"><div><p className="eyebrow">THE MAATI EDIT</p><h2>Things worth<br />bringing home.</h2></div><p>Thoughtfully discovered.<br />Carefully considered.<br />Made for everyday life.</p></div><div className="product-grid">{products.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}</div></section>

    <section className="why section-grid"><div><p className="eyebrow">WHY MAATI LIVING</p><h2>Because the<br /><em>little things</em> matter.</h2></div><div className="body-copy"><p>We use so many things every day without really thinking about where they come from or how they're made.</p><p>We started Maati Living because we wanted to look a little closer — at the materials, the makers and the stories behind the products we bring home.</p></div></section>

    <section className="beliefs section"><p className="eyebrow">WHAT WE BELIEVE</p><div className="belief-list">{beliefs.map(([number, title, copy]) => <div className="belief" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></div>)}</div></section>

    <section id="story" className="story section-grid"><div className="story-visual"><TextilePlaceholder variant="rust" label="Warm textile image placeholder" /></div><div className="story-copy"><p className="eyebrow">OUR STORY</p><h2>Two women.<br /><em>One idea.</em></h2><p>Can we bring better, more thoughtful products into everyday life without making things complicated?</p><p>Two sisters-in-law. Two very different backgrounds. One shared curiosity about good products, the people who make them and the stories behind them.</p><a className="text-link" href="#contact">Meet the women behind Maati <ArrowUpRight size={15} /></a></div></section>

    <section id="approach" className="approach section"><div><p className="eyebrow">BEFORE WE SAY YES</p><h2>We ask a few questions.</h2></div><div className="questions">{["What is it made of?", "Who made it?", "How is it made?", "Will we actually use it?"].map((question, i) => <p key={question}><span>0{i + 1}</span>{question}</p>)}<strong>Would we buy it for ourselves?</strong></div></section>

    <section id="contact" className="final-cta"><p className="eyebrow">A SMALL BEGINNING</p><h2>Find something<br /><em>thoughtfully chosen.</em></h2><p>We're starting small — discovering products, meeting makers and building Maati Living one product at a time.</p><a className="button button-light" href="#collection">Explore Maati Living <ArrowUpRight size={16} /></a></section>

    <footer><div className="footer-brand"><a className="logo" href="#top" aria-label="Maati Living home"><img src={siteConfig.logoUrl} alt="Maati Living" /></a><p>Thoughtfully chosen.<br />Naturally better.</p></div><div className="footer-links"><div><span className="eyebrow">Explore</span><a href="#collection">Shop</a><a href="#story">Our Story</a><a href="#approach">Our Approach</a></div><div><span className="eyebrow">Say hello</span><a href={siteConfig.instagramUrl}>Instagram</a><a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></div></div><small>© {new Date().getFullYear()} Maati Living. Made with thought.</small></footer>
    <a className="floating-whatsapp" href={getWhatsAppUrl("something from Maati Living")} target="_blank" rel="noreferrer">WhatsApp <ArrowUpRight size={14} /></a>
  </main>;
}
