// Two-column frame for sign in / sign up / password pages.
export default function AuthPage({ eyebrow, title, intro, children }) {
  return <section className="auth-page section-grid">
    <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{intro && <p className="auth-intro">{intro}</p>}</div>
    <div className="auth-panel">{children}</div>
  </section>;
}
