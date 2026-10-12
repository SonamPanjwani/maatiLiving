const beliefs = [
  ["01", "Thoughtful Materials", "Natural materials and simple things that don't need a lot of explaining."],
  ["02", "Made with Purpose", "We look for products made by people who care about what they make — especially Indian artisans and small makers."],
  ["03", "Less Waste", "We're always looking for simple swaps that can help us use less plastic and waste less."],
  ["04", "Made for Everyday Life", "Sustainable doesn't help much if it just sits on a shelf. We look for things you'll actually use."],
  ["05", "Rooted in India", "India has so much to offer — from traditional crafts to natural materials and age-old ways of making things."],
];

export default function Beliefs() {
  return <section className="beliefs section"><p className="eyebrow">WHAT WE BELIEVE</p><div className="belief-list">{beliefs.map(([number, title, copy]) => <div className="belief" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></div>)}</div></section>;
}
