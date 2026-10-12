import { ArrowUpRight } from "lucide-react";
import { getWhatsAppUrl } from "@/src/config/site";

export default function WhatsAppLink({ productName, children = "ENQUIRE ON WHATSAPP", className = "" }) {
  return <a className={`whatsapp-link ${className}`} href={getWhatsAppUrl(productName)} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={15} /></a>;
}
