import { ArrowUpRight } from "lucide-react";
import TextilePlaceholder from "@/components/common/TextilePlaceholder";

export default function Story() {
  return <section id="story" className="story section-grid"><div className="story-visual"><TextilePlaceholder variant="rust" label="Warm textile image placeholder" /></div><div className="story-copy"><p className="eyebrow">OUR STORY</p><h2>Two women.<br /><em>One idea.</em></h2><p>Can we bring better, more thoughtful products into everyday life without making things complicated?</p><p>Two sisters-in-law. Two very different backgrounds. One shared curiosity about good products, the people who make them and the stories behind them.</p><a className="text-link" href="#contact">Meet the women behind Maati <ArrowUpRight size={15} /></a></div></section>;
}
