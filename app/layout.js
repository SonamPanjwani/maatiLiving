import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import { ogImageUrl, siteUrl } from "@/src/config/seo";
import { siteConfig } from "@/src/config/site";

// Self-hosted at build time (no request to Google from visitors' browsers). Same families as before.
const fraunces = Fraunces({ subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"], variable: "--font-fraunces", display: "swap" });
const workSans = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-work-sans", display: "swap" });

const ogImage = ogImageUrl();

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Maati Living — Thoughtfully chosen. Naturally better.",
    template: "%s — Maati Living",
  },
  description: "Handmade terracotta diyas and coconut shell pieces from Indian artisans. Natural, useful and beautifully made things for everyday life.",
  applicationName: siteConfig.name,
  icons: { icon: siteConfig.logoUrl, apple: siteConfig.logoUrl },
  // No canonical/og:url here: metadata is inherited, so each page sets its own.
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: "en_IN",
    images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: "Maati Living" }] : undefined,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport = { themeColor: "#2A2622" };

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${workSans.variable}`}>
      <body>
        <a className="skip-link" href="#content">Skip to content</a>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
