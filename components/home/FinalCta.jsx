import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function FinalCta() {
  return <section className="final-cta"><p className="eyebrow">A SMALL BEGINNING</p><h2>Find something<br /><em>thoughtfully chosen.</em></h2><p>We're starting small: discovering products, meeting makers and building Maati Living one product at a time.</p><Link className="button button-light" href="/shop">Explore the shop <ArrowUpRight size={16} /></Link></section>;
}
