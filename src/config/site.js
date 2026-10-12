export const siteConfig = {
  name: "Maati Living",
  tagline: "Thoughtfully chosen. Naturally better.",
  description: "Natural, useful and beautifully made things for everyday life.",
  logoPublicId: "Logo",
  logoUrl: "https://res.cloudinary.com/diyhsqkum/image/upload/v1789316692/Logo.png",
  whatsappNumber: "YOUR_WHATSAPP_NUMBER",
  instagramUrl: "https://instagram.com/your-handle",
  email: "hello@example.com",
};

export function getWhatsAppUrl(productName) {
  const message = `Hi Maati Living, I'm interested in ${productName}. Could you please share availability and details?`;
  return `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
