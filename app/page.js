import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import Intro from "@/components/home/Intro";
import Collection from "@/components/home/Collection";
import Why from "@/components/home/Why";
import Beliefs from "@/components/home/Beliefs";
import Story from "@/components/home/Story";
import Approach from "@/components/home/Approach";
import FinalCta from "@/components/home/FinalCta";
import Footer from "@/components/home/Footer";
import FloatingWhatsApp from "@/components/common/FloatingWhatsApp";
import { jsonLd, siteUrl } from "@/src/config/seo";
import { siteConfig } from "@/src/config/site";

// Re-fetch the catalogue at most once a minute; admin saves also revalidate immediately.
export const revalidate = 60;
export const metadata = { alternates: { canonical: "/" } };

export default function Home() {
  const organisation = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteUrl,
    logo: siteConfig.logoUrl,
    sameAs: [siteConfig.instagramUrl],
    contactPoint: { "@type": "ContactPoint", contactType: "customer service", email: siteConfig.email, areaServed: "IN" },
  };
  return <>
    <Navbar />
    <main id="content">
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organisation)} />
    <Hero />
    <Intro />
    <Collection />
    <Why />
    <Beliefs />
    <Story />
    <Approach />
    <FinalCta />
    </main>
    <Footer />
    <FloatingWhatsApp />
  </>;
}
