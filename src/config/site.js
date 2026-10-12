// Contact details are read from env (see .env.example) so they can differ per
// environment without code changes. Fallbacks keep the site rendering if unset.
export const siteConfig = {
  name: "Maati Living",
  tagline: "Thoughtfully chosen. Naturally better.",
  description: "Natural, useful and beautifully made things for everyday life.",
  logoPublicId: "Logo",
  logoUrl: "https://res.cloudinary.com/diyhsqkum/image/upload/v1789316692/Logo.png",
  // TODO: set NEXT_PUBLIC_WHATSAPP_NUMBER to the business number — digits only, with country code, e.g. 919876543210.
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "YOUR_WHATSAPP_NUMBER",
  instagramHandle: "@maatiliving",
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://instagram.com/maatiliving",
  // TODO: set NEXT_PUBLIC_CONTACT_EMAIL once the Maati Living mailbox exists.
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@example.com",
};

export function getWhatsAppUrl(productName) {
  const message = `Hi Maati Living, I'm interested in ${productName}. Could you please share availability and details?`;
  return `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
