import { cloudinaryConfig } from "./cloudinary";

// Absolute site URL for canonical links, the sitemap and social previews.
// TODO(launch): set NEXT_PUBLIC_SITE_URL to the real https:// domain.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

// Social preview (1200×630) built from a Cloudinary image; defaults to the first hero photo.
export function ogImageUrl(publicId = "hero1") {
  if (!cloudinaryConfig.cloudName || !publicId) return undefined;
  return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/${publicId}`;
}

// Serialises JSON-LD safely for a <script> tag (no "</script>" breakouts).
export function jsonLd(data) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
