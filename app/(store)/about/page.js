import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import TextilePlaceholder from "@/components/common/TextilePlaceholder";
import { V } from "@/components/legal/LegalPage";
import { business } from "@/src/config/business";

export const metadata = { alternates: { canonical: "/about" },
  title: "Our story",
  description: "Two sisters-in-law, one idea: bringing thoughtful, handmade Indian products into everyday life.",
};

const QUESTIONS = ["What is it made of?", "Who made it?", "How is it made?", "Will we actually use it?"];

export default function AboutPage() {
  return <>
    <section className="story section-grid about-hero">
      <div className="story-visual"><TextilePlaceholder variant="rust" label="Photo of the founders" /></div>
      <div className="story-copy">
        <p className="eyebrow">OUR STORY</p>
        <h1>Two women.<br /><em>One idea.</em></h1>
        <p>Can we bring better, more thoughtful products into everyday life without making things complicated?</p>
        <p>Two sisters-in-law. Two very different backgrounds. One shared curiosity about good products, the people who make them and the stories behind them.</p>
        <p>Maati means earth, the clay our diyas are thrown from, and the ground everything good grows in. That's where we started: with simple, natural things made by hand, by people who care about what they make.</p>
      </div>
    </section>

    <section className="about-founders section">
      <div className="section-heading"><div><p className="eyebrow">THE WOMEN BEHIND MAATI</p><h2>Meet<br /><em>the founders.</em></h2></div></div>
      <div className="founders-grid">
        {business.founders.map((founder, index) => <article key={index} className="founder">
          <div className="founder-photo"><TextilePlaceholder variant={index ? "moss" : "indigo"} label={`Portrait of ${founder.name}`} /></div>
          <span className="eyebrow">{founder.role}</span>
          <h3><V>{founder.name}</V></h3>
          <p><V>{founder.bio}</V></p>
        </article>)}
      </div>
    </section>

    <section className="approach section">
      <div><p className="eyebrow">BEFORE WE SAY YES</p><h2>We ask a few questions.</h2></div>
      <div className="questions">{QUESTIONS.map((question, i) => <p key={question}><span>0{i + 1}</span>{question}</p>)}<strong>Would we buy it for ourselves?</strong></div>
    </section>

    <section className="final-cta">
      <p className="eyebrow">A SMALL BEGINNING</p>
      <h2>Find something<br /><em>thoughtfully chosen.</em></h2>
      <p>We're starting small: discovering products, meeting makers and building Maati Living one product at a time.</p>
      <Link className="button button-light" href="/shop">Explore the shop <ArrowUpRight size={16} /></Link>
    </section>
  </>;
}
