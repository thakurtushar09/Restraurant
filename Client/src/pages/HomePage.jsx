import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import RestaurantCard from '../components/RestaurantCard.jsx'
import './home.css'

const DISHES = ['Truffle mushroom risotto', 'Wood-fired margherita', 'Butter chicken', 'Pesto pasta', 'Buddha bowl', 'Masala dosa', 'Sourdough & burrata', 'Tiramisu', 'Thai green curry', 'Shakshuka']

const TIMELINE = [
  ['6:40 PM', 'You pre-order', 'Pick your dishes, how many of you are coming, and a 7:30 table.'],
  ['7:05 PM', 'The kitchen starts cooking', 'Timed from your arrival, so nothing sits under a heat lamp.'],
  ['7:30 PM', 'You sit down. Food arrives.', 'Give your name at the door. Dinner is already on its way to the table.'],
]

const REASONS = [
  { icon: 'clock', title: 'Zero waiting', text: 'Skip the 30 minutes between ordering and eating. Arrive hungry, eat straight away.', big: '0 min' },
  { icon: 'flame', title: 'Fresh, never reheated', text: 'Cooking starts when your arrival time says so — not hours before.' },
  { icon: 'refresh', title: 'Plans change', text: 'Running late? Move your time or cancel until the restaurant confirms.' },
  { icon: 'bike', title: 'Staying in tonight?', text: 'The same kitchens deliver — as soon as possible or at a time you choose.' },
]

export default function HomePage({ navigate, openRestaurant }) {
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
    fetch('/api/v1/public/branches', { signal: controller.signal })
      .then((response) => response.json())
      .then((result) => { if (result.success) setFeatured(result.data.slice(0, 6)) })
      .catch(() => { /* the section simply stays hidden */ })
    return () => controller.abort()
  }, [])

  const scrollToHow = (event) => {
    event.preventDefault()
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <main className="home" ref={rootRef}>
      {/* ---------- hero ---------- */}
      <section className="h-hero">
        <div className="h-glow" aria-hidden="true" />
        <div className="wrap h-hero-inner">
          <div className="h-copy">
            <span className="h-pill"><span className="pulse" />Pre-order · Arrive · Eat</span>
            <h1 className="h-title">
              <span className="line"><span style={{ '--d': '80ms' }}>Skip the wait.</span></span>
              <span className="line"><span style={{ '--d': '220ms' }}><em>Your table’s ready</em></span></span>
              <span className="line"><span style={{ '--d': '360ms' }}><em>when you are.</em></span></span>
            </h1>
            <p className="h-lede">Order ahead from local kitchens and choose when you’ll arrive. The kitchen times your meal so it reaches the table as you sit down.</p>
            <div className="h-actions">
              <button className="btn h-btn-light" onClick={() => navigate('explore')}>Pre-order a meal <Icon name="arrow" size={17} /></button>
              <a className="btn h-btn-outline" href="#how-it-works" onClick={scrollToHow}>See how it works</a>
            </div>
            <dl className="h-stats">
              <div><dt>0 min</dt><dd>waiting at the table</dd></div>
              <div><dt>7 days</dt><dd>book up to a week ahead</dd></div>
              <div><dt>2 ways</dt><dd>dine in or delivery</dd></div>
            </dl>
          </div>

          <div className="h-visual">
            <div className="h-arch"><div className="h-photo" role="img" aria-label="A freshly served meal on a table" /></div>
            <div className="h-card h-card-booking">
              <span className="h-icon"><Icon name="calendar" size={18} /></span>
              <span><strong>Table for 2 · 7:30 PM</strong><small>Bowl &amp; Bloom, Indiranagar</small></span>
            </div>
            <div className="h-card h-card-kitchen">
              <span className="h-icon"><Icon name="flame" size={16} /></span>
              <span><strong>Kitchen starts 7:05</strong></span>
            </div>
            <div className="h-card h-card-progress" aria-hidden="true">
              <div className="h-progress-head"><strong>Your pre-order</strong><span>on time</span></div>
              <div className="h-progress"><i /></div>
              <div className="h-progress-steps"><span>Booked</span><span>Cooking</span><span>Ready</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- dish ticker ---------- */}
      <div className="h-marquee" aria-hidden="true">
        <div className="h-marquee-track">
          {[...DISHES, ...DISHES].map((dish, index) => <span key={index}>{dish}</span>)}
        </div>
      </div>

      {/* ---------- timeline ---------- */}
      <section className="section" id="how-it-works">
        <div className="wrap h-how">
          <div className="h-how-head" data-reveal>
            <span className="eyebrow">How pre-ordering works</span>
            <h2>An evening, timed <em>to the minute.</em></h2>
            <p>No more sitting hungry while the kitchen catches up. You choose the time; they cook to it.</p>
            <button className="btn btn-primary" onClick={() => navigate('explore')}>Find a kitchen <Icon name="arrow" size={16} /></button>
          </div>
          <ol className="h-timeline" data-reveal>
            {TIMELINE.map(([time, title, text], index) => (
              <li key={time} data-reveal style={{ '--d': `${150 + index * 160}ms` }}>
                <span className="h-time">{time}</span>
                <span className="h-dot" />
                <div><h3>{title}</h3><p>{text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- reasons ---------- */}
      <section className="section h-reasons-section">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <div><span className="eyebrow">Why people pre-order</span><h2>Dinner, without <em>the waiting part.</em></h2></div>
          </div>
          <div className="h-bento">
            {REASONS.map((reason, index) => (
              <article key={reason.title} className={`h-tile${reason.big ? ' h-tile-feature' : ''}`} data-reveal style={{ '--d': `${index * 90}ms` }}>
                <span className="h-icon"><Icon name={reason.icon} size={20} /></span>
                {reason.big && <span className="h-big">{reason.big}</span>}
                <h3>{reason.title}</h3>
                <p>{reason.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- kitchens ---------- */}
      {featured.length > 0 && (
        <section className="section section-alt">
          <div className="wrap">
            <div className="section-head" data-reveal>
              <div><span className="eyebrow">Taking pre-orders now</span><h2>Kitchens worth <em>knowing.</em></h2></div>
              <button className="link" onClick={() => navigate('explore')}>See all kitchens <Icon name="arrow" size={16} /></button>
            </div>
            <div className="restaurant-grid">
              {featured.map((restaurant, index) => <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} onOpen={openRestaurant} />)}
            </div>
          </div>
        </section>
      )}

      {/* ---------- closing call to action ---------- */}
      <section className="section">
        <div className="wrap">
          <div className="h-cta" data-reveal>
            <div className="h-glow" aria-hidden="true" />
            <h2>Hungry later? <em>Book it now.</em></h2>
            <p>Pick a kitchen, pick a time, and walk in to a meal that’s ready for you.</p>
            <button className="btn h-btn-light" onClick={() => navigate('explore')}>Pre-order a meal <Icon name="arrow" size={17} /></button>
          </div>
        </div>
      </section>
    </main>
  )
}
