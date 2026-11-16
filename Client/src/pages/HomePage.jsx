import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import RestaurantCard from '../components/RestaurantCard.jsx'
import useHomeMotion from './useHomeMotion.js'
import './home.css'

const WAYS = [
  { icon: 'scan', title: 'At the table', text: 'Scan the QR, add your table number, done.' },
  { icon: 'calendar', title: 'Pre-order', text: 'Pick a time. Food’s ready when you walk in.' },
  { icon: 'bike', title: 'Delivery', text: 'The same kitchens, brought to your door.' },
]

const TICKER = ['Scan your table', 'Pre-order ahead', 'Fresh from local kitchens', 'Walk in, sit down, eat', 'Delivered to your door']

export default function HomePage({ navigate, openRestaurant, location, onScan, dineIn }) {
  const [featured, setFeatured] = useState([])
  const [slide, setSlide] = useState(0)
  const rootRef = useRef(null)
  const carouselRef = useRef(null)
  useHomeMotion(rootRef)

  // Phone carousel: which card is nearest the left edge, for the dots.
  function onCarouselScroll() {
    const track = carouselRef.current
    if (!track) return
    const cards = [...track.children]
    const nearest = cards.reduce((best, card, index) => (Math.abs(card.offsetLeft - track.offsetLeft - track.scrollLeft) < Math.abs(cards[best].offsetLeft - track.offsetLeft - track.scrollLeft) ? index : best), 0)
    setSlide(nearest)
  }

  function goToSlide(index) {
    const track = carouselRef.current
    const card = track?.children[index]
    if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: 'smooth' })
  }

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
            <span className="h-dots" aria-hidden="true"><i /><i /><i /><i /><i /></span>
            <div className="h-actions">
              <button className="btn h-btn-light" data-magnetic onClick={onScan}><Icon name="scan" size={18} /> Scan &amp; order</button>
              <button className="btn h-btn-outline" data-magnetic onClick={() => navigate('explore')}>Explore kitchens <Icon name="arrow" size={17} /></button>
            </div>
            {dineIn && (
              <button className="h-table-resume" onClick={() => openRestaurant(dineIn.publicSlug)}>
                <Icon name="qr" size={16} /> Back to the menu you scanned <Icon name="arrow" size={15} />
              </button>
            )}
          </div>

          <div className="h-visual">
            <div className="h-tilt">
              <div className="h-plate"><div className="h-photo" role="img" aria-label="A freshly served bowl seen from above" /></div>
              <span className="h-leaf" aria-hidden="true" />
              <div className="h-card h-card-order">
                <span className="h-icon"><Icon name="check" size={18} /></span>
                <span><strong>Table 12 · Order sent</strong><small>Ready in about 20 min</small></span>
              </div>
            </div>
          </div>
        </div>
        <a className="h-scroll-cue" href="#how-it-works" aria-label="Scroll to how it works"><span /></a>
        <div className="h-torn" aria-hidden="true" />
      </section>

      {/* ---------- ways to order ---------- */}
      <section className="section h-ways-section" id="how-it-works">
        <div className="wrap h-ways-head" data-reveal>
          <span className="eyebrow">How it works</span>
          <h2>Three ways to <em>skip the wait.</em></h2>
        </div>
        <div className="wrap h-ways">
          {WAYS.map((way, index) => (
            <article key={way.title} className="h-way" data-reveal data-spotlight style={{ '--d': `${index * 90}ms` }}>
              <span className="h-num" aria-hidden="true">0{index + 1}</span>
              <span className="h-icon"><Icon name={way.icon} size={20} /></span>
              <h3>{way.title}</h3>
              <p>{way.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- ticker ---------- */}
      <div className="h-ticker" aria-hidden="true">
        <div className="h-ticker-track">
          {[0, 1].map((copy) => (
            <span key={copy}>{TICKER.map((text) => <span key={text}>{text}<i /></span>)}</span>
          ))}
        </div>
      </div>

      {/* ---------- kitchens ---------- */}
      {featured.length > 0 && (
        <section className="section h-kitchens">
          <div className="h-torn top" aria-hidden="true" />
          <div className="wrap">
            <div className="section-head" data-reveal>
              <div><span className="eyebrow">{location ? `Near ${location.label || 'you'}` : 'Open for orders'}</span><h2>Kitchens <em>nearby.</em></h2></div>
              <button className="link" onClick={() => navigate('explore')}>See all <Icon name="arrow" size={16} /></button>
            </div>
            <div className="restaurant-grid h-carousel" ref={carouselRef} onScroll={onCarouselScroll}>
              {featured.map((restaurant, index) => <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} onOpen={openRestaurant} />)}
            </div>
            {featured.length > 1 && (
              <div className="h-carousel-dots" role="tablist" aria-label="Kitchens">
                {featured.map((restaurant, index) => (
                  <button key={restaurant.id} type="button" role="tab" aria-selected={index === slide} aria-label={`Show ${restaurant.restaurantGroup.groupName}`} onClick={() => goToSlide(index)} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
