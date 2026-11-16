// Full-bleed photo with the pitch on the left and the form in a floating card on the right.
export default function AuthLayout({ eyebrow, title, lede, extra, children }) {
  return (
    <main className="auth">
      <div className="auth-photo" aria-hidden="true" />
      <section className="auth-intro">
        <span className="band-pill">{eyebrow}</span>
        <h1><span key={eyebrow}>{title}</span></h1>
        <p>{lede}</p>
        {extra}
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  )
}
