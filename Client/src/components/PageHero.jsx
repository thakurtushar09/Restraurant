import Icon from './Icon.jsx'

// Dark forest band used at the top of customer pages; matches the home hero.
export default function PageHero({ eyebrow, title, lede, back, onBack, children, compact = false, image }) {
  return (
    <section className={`band page-hero${compact ? ' compact' : ''}`}>
      {image && <div className="band-image" style={{ backgroundImage: `url(${image})` }} aria-hidden="true" />}
      <div className="band-glow" aria-hidden="true" />
      <div className="wrap page-hero-inner">
        {back && <button className="band-back" onClick={onBack}><Icon name="back" size={16} /> {back}</button>}
        {eyebrow && <span className="band-pill">{eyebrow}</span>}
        <h1 className="band-title"><span>{title}</span></h1>
        {lede && <p className="band-lede">{lede}</p>}
        {children}
      </div>
    </section>
  )
}
