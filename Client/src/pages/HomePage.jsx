import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import RestaurantCard from '../components/RestaurantCard.jsx'
import './home.css'

const WAYS = [
  { icon: 'scan', title: 'At the table', text: 'Scan the QR, add your table number, done.' },
  { icon: 'calendar', title: 'Pre-order', text: 'Pick a time. Food’s ready when you walk in.' },
  { icon: 'bike', title: 'Delivery', text: 'The same kitchens, brought to your door.' },
]

export default function HomePage({ navigate, openRestaurant, location, onScan, dineIn }) {
  const [featured, setFeatured] = useState([])
  const rootRef = useRef(null)

  // Adds `is-in` to [data-reveal] elements as they scroll into view (re-run when kitchens load).
  useEffect(() => {
    const nodes = rootRef.current?.querySelectorAll('[data-reveal]:not(.is-in)') ?? []
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add('is-in'))
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [featured.length])

  useEffect(() => {
    const controller = new AbortController()
    const near = location ? `?${new URLSearchParams({ lat: location.latitude, lng: location.longitude })}` : ''
    fetch(`/api/v1/public/branches${near}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => { if (result.success) setFeatured(result.data.slice(0, 3)) })
      .catch(() => { /* the section simply stays hidden */ })
    return () => controller.abort()
  }, [location])

  return (
    <main className="home" ref={rootRef}>
      {/* ---------- hero ---------- */}
      <section className="h-hero">
        <div className="h-glow" aria-hidden="true" />
        <div className="wrap h-hero-inner">
          <div className="h-copy">
            <span className="h-pill"><span className="pulse" />Scan · Order · Eat</span>
            <h1 className="h-title">
              <span className="line"><span style={{ '--d': '80ms' }}>Skip the wait.</span></span>
              <span className="line"><span style={{ '--d': '220ms' }}><em>Order from your seat.</em></span></span>
            </h1>
            <p className="h-lede">Scan the QR on your table, or pre-order before you arrive.</p>
            <div className="h-actions">
              <button className="btn h-btn-light" onClick={onScan}><Icon name="scan" size={18} /> Scan &amp; order</button>
              <button className="btn h-btn-outline" onClick={() => navigate('explore')}>Explore kitchens <Icon name="arrow" size={17} /></button>
            </div>
            {dineIn && (
              <button className="h-table-resume" onClick={() => openRestaurant(dineIn.publicSlug)}>
                <Icon name="qr" size={16} /> Back to the menu you scanned <Icon name="arrow" size={15} />
              </button>
            )}
          </div>

          <div className="h-visual">
            <div className="h-arch"><div className="h-photo" role="img" aria-label="A freshly served meal on a table" /></div>
            <div className="h-card h-card-order">
              <span className="h-icon"><Icon name="check" size={18} /></span>
              <span><strong>Table 12 · Order sent</strong><small>Ready in about 20 min</small></span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- ways to order ---------- */}
      <section className="section h-ways-section" id="how-it-works">
        <div className="wrap h-ways">
          {WAYS.map((way, index) => (
            <article key={way.title} className="h-way" data-reveal style={{ '--d': `${index * 90}ms` }}>
              <span className="h-icon"><Icon name={way.icon} size={20} /></span>
              <h3>{way.title}</h3>
              <p>{way.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- kitchens ---------- */}
      {featured.length > 0 && (
        <section className="section section-alt">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <div><span className="eyebrow">{location ? `Near ${location.label || 'you'}` : 'Open for orders'}</span><h2>Kitchens <em>nearby.</em></h2></div>
              <button className="link" onClick={() => navigate('explore')}>See all <Icon name="arrow" size={16} /></button>
            </div>
            <div className="restaurant-grid">
              {featured.map((restaurant, index) => <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} onOpen={openRestaurant} />)}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
