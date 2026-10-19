// Contact details are read from env (see .env.example) so they can differ per
// environment without code changes. Fallbacks keep the site rendering if unset.
export const siteConfig = {
  name: "Maati Living",
  tagline: "Thoughtfully chosen. Naturally better.",
  description: "Natural, useful and beautifully made things for everyday life.",
  // Round logo (transparent PNG in maatiLiving/brand on Cloudinary), trimmed to the circle and sized for the web.
  // Shown on a cream disc (see .logo img in globals.css) so the dark lettering stays readable on dark bars.
  logoPublicId: "MAATI__3_-removebg-preview_3",
  logoUrl: "https://res.cloudinary.com/fecxf6f2/image/upload/e_trim/w_240,c_fit/f_auto,q_auto/v1792444692/MAATI__3_-removebg-preview_3.png",
  // TODO: set NEXT_PUBLIC_WHATSAPP_NUMBER to the business number — digits only, with country code, e.g. 919876543210.
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "YOUR_WHATSAPP_NUMBER",
  instagramHandle: "@maatiliving",
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://instagram.com/maatiliving",
  // TODO: set NEXT_PUBLIC_CONTACT_EMAIL once the Maati Living mailbox exists.
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@example.com",
};

export function getWhatsAppOrderUrl(orderNumber) {
  return `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(`Hi Maati Living, I have a question about my order ${orderNumber}.`)}`;
}

export function getWhatsAppUrl(productName) {
  const message = `Hi Maati Living, I'm interested in ${productName}. Could you please share availability and details?`;
  return `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
