import { ArrowUpRight, MessageCircle } from "lucide-react";
import { getWhatsAppUrl } from "@/src/config/site";

// Desktop: "WhatsApp ↗" tab. Phones: a round icon-only button (pages keep space at the bottom so it never covers
// content). The accessible name stays "Chat with us on WhatsApp" either way.
export default function FloatingWhatsApp() {
  return <a className="floating-whatsapp" href={getWhatsAppUrl("something from Maati Living")} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp (opens WhatsApp)">
    <MessageCircle size={18} aria-hidden="true" className="floating-whatsapp-icon" />
    <span className="floating-whatsapp-label" aria-hidden="true">WhatsApp</span>
    <ArrowUpRight size={14} aria-hidden="true" className="floating-whatsapp-arrow" />
  </a>;
}
