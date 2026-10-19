const questions = ["What is it made of?", "Who made it?", "How is it made?", "Will we actually use it?"];

export default function Approach() {
  return <section id="approach" className="approach section"><div><p className="eyebrow">BEFORE WE SAY YES</p><h2>We ask a few questions.</h2></div><div className="questions">{questions.map((question, i) => <p key={question}><span>0{i + 1}</span>{question}</p>)}<strong><span className="questions-lead">And most importantly,</span>would we buy it for ourselves?</strong></div></section>;
}
