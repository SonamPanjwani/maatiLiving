import { ArrowUpRight } from "lucide-react";
import { getWhatsAppUrl } from "@/src/config/site";

export default function FloatingWhatsApp() {
  return <a className="floating-whatsapp" href={getWhatsAppUrl("something from Maati Living")} target="_blank" rel="noreferrer">WhatsApp <ArrowUpRight size={14} /></a>;
}
