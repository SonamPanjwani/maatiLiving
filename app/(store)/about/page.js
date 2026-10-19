import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import TextilePlaceholder from "@/components/common/TextilePlaceholder";
import { V } from "@/components/legal/LegalPage";
import { business } from "@/src/config/business";

export const metadata = { alternates: { canonical: "/about" },
  title: "Our story",
  description: "Three women, one idea: making conscious living simpler with natural, handmade Indian products for everyday life.",
};

const QUESTIONS = ["What is it made of?", "Who made it?", "How is it made?", "Will we actually use it?"];
const VARIANTS = ["indigo", "moss", "rust"];

export default function AboutPage() {
  return <>
    <section className="story section-grid about-hero">
      <div className="story-visual"><TextilePlaceholder variant="rust" label="Photo of the founders" /></div>
      <div className="story-copy">
        <p className="eyebrow">OUR STORY</p>
        <h1>Three women.<br /><em>One idea.</em></h1>
        <p>Maati Living started with a fairly simple question: can we bring better, more thoughtful products into everyday life without making things complicated?</p>
        <p>Our backgrounds are quite different. But we all enjoy discovering good products, understanding how they're made and finding better ways of doing things.</p>
        <p>So, we're giving this a shot. Starting small. Learning along the way. And building Maati Living one product at a time.</p>
      </div>
    </section>

    <section className="about-pillars section">
      <div className="about-pillar">
        <p className="eyebrow">OUR VISION</p>
        <h2>Making conscious living <em>simpler.</em></h2>
        <p>We don't think you need to change your whole life to live more consciously. Sometimes, it starts with something as simple as choosing a natural soap, a handmade product or an everyday alternative that creates a little less waste. We want to make those choices easier to find.</p>
      </div>
      <div className="about-pillar">
        <p className="eyebrow">OUR OBJECTIVE</p>
        <h2>To make better choices <em>a little easier.</em></h2>
        <p>We're building Maati Living as a place where you can discover natural, handcrafted and thoughtfully made products without having to spend hours looking for them. We'll keep exploring, learning and finding makers we believe in.</p>
      </div>
    </section>

    <section className="about-founders section">
      <div className="section-heading"><div><p className="eyebrow">THE PEOPLE BEHIND MAATI LIVING</p><h2>Meet<br /><em>the founders.</em></h2></div></div>
      <div className="founders-grid">
        {business.founders.map((founder, index) => <article key={index} className="founder">
          <div className="founder-photo"><TextilePlaceholder variant={VARIANTS[index % VARIANTS.length]} label={`Portrait of ${founder.name}`} /></div>
          <span className="eyebrow">{founder.role}</span>
          <h3><V>{founder.name}</V></h3>
          {founder.bio.map((paragraph, i) => <p key={i}><V>{paragraph}</V></p>)}
        </article>)}
      </div>
    </section>

    <section className="approach section">
      <div><p className="eyebrow">OUR APPROACH</p><h2>We ask a few questions before we say yes.</h2></div>
      <div className="questions">{QUESTIONS.map((question, i) => <p key={question}><span>0{i + 1}</span>{question}</p>)}<strong><span className="questions-lead">And most importantly,</span>would we buy it for ourselves?</strong>
        <p className="questions-after">If the answer feels right, it might just find a place at Maati Living.</p>
      </div>
    </section>

    <section className="about-promise section-grid">
      <div><p className="eyebrow">OUR PROMISE</p><h2>We're figuring<br /><em>it out too.</em></h2></div>
      <div className="body-copy">
        <p>We're not here to tell you that we've found the perfect way to live sustainably. We haven't.</p>
        <p>We're learning as we go, asking questions, discovering amazing makers and making better choices where we can.</p>
        <p>And we'd love for you to come along.</p>
      </div>
    </section>

    <section className="final-cta">
      <p className="eyebrow">A SMALL BEGINNING</p>
      <h2>Find something<br /><em>thoughtfully chosen.</em></h2>
      <p>We're starting small: discovering products, meeting makers and building Maati Living one product at a time.</p>
      <Link className="button button-light" href="/shop">Explore the shop <ArrowUpRight size={16} /></Link>
    </section>
  </>;
}
