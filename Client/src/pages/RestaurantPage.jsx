import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import PageHero from '../components/PageHero.jsx'
import VariantModal from '../components/VariantModal.jsx'
import useReveal from '../components/useReveal.js'
import { money, isOpenAt } from '../lib.js'

const initial = (name) => name.trim().charAt(0).toUpperCase()

export default function RestaurantPage({ slug, navigate, addToCart }) {
  const [menu, setMenu] = useState(null)
  const [error, setError] = useState('')
  const [choosing, setChoosing] = useState(null)
  const [activeCategory, setActiveCategory] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/v1/public/branches/${encodeURIComponent(slug)}/menu`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.message || 'Could not load this restaurant')
        setMenu(result.data)
      })
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message || 'Could not load this restaurant') })
    return () => controller.abort()
  }, [slug])

  const categories = useMemo(() => menu?.categories.filter((category) => category.menuItems.length > 0) ?? [], [menu])
  useReveal(rootRef, categories.length)

  // Highlight the category currently on screen.
  useEffect(() => {
    if (!categories.length || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setActiveCategory(visible.target.id)
      // Back at the top of the menu: highlight the first category again.
      else if (window.scrollY < 200) setActiveCategory('')
    }, { rootMargin: '-140px 0px -55% 0px' })
    categories.forEach((category) => {
      const node = document.getElementById(`category-${category.id}`)
      if (node) observer.observe(node)
    })
    return () => observer.disconnect()
  }, [categories])

  const openNow = menu ? isOpenAt(menu.openingHours, menu.timezone, new Date()) : false
  const add = (item) => item.variants.length ? setChoosing(item) : addToCart(menu, item, null)
  const coverImage = menu?.categories.flatMap((category) => category.menuItems).find((item) => item.imageUrl)?.imageUrl

  if (error) {
    return (
      <main>
        <PageHero compact back="All kitchens" onBack={() => navigate('explore')} title={<>This kitchen is <em>unavailable.</em></>} lede={error} />
        <div className="wrap overlap" style={{ paddingBottom: 80 }}>
          <div className="state" style={{ background: 'var(--white)' }}><button className="btn btn-primary" onClick={() => navigate('explore')}>Back to Explore</button></div>
        </div>
      </main>
    )
  }

  if (!menu) {
    return (
      <main>
        <section className="band page-hero"><div className="band-glow" /><div className="wrap page-hero-inner"><div className="skeleton" style={{ width: 320, height: 64, opacity: .15 }} /></div></section>
        <div className="wrap overlap" style={{ display: 'grid', gap: 16, paddingBottom: 80 }}>
          <div className="skeleton" style={{ height: 160 }} />
          <div className="skeleton" style={{ height: 160 }} />
        </div>
      </main>
    )
  }

  return (
    <main ref={rootRef}>
      <div className="r-band">
        <PageHero
          back="All kitchens"
          onBack={() => navigate('explore')}
          eyebrow={menu.restaurantGroup.groupName}
          image={coverImage}
          title={menu.branchName}
        >
          <div className="avatar">{menu.restaurantGroup.logoUrl ? <img src={menu.restaurantGroup.logoUrl} alt="" /> : initial(menu.restaurantGroup.groupName)}</div>
          <div className="meta">
            <span><Icon name="pin" size={15} />{[menu.addressLine1, menu.city, menu.state].filter(Boolean).join(', ')}</span>
            <span><Icon name="clock" size={15} />About {menu.averagePreparationTimeMinutes} min to prepare</span>
          </div>
          <div className="chips">
            {menu.openingHours && <span className={`open-state on-dark${openNow ? ' open' : ''}`}>{openNow ? 'Open now' : 'Closed now · pre-order for later'}</span>}
            {menu.acceptsDineIn && <span className="chip">Pre-order</span>}
            {menu.acceptsDelivery && <span className="chip">Delivery</span>}
          </div>
        </PageHero>
      </div>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        {categories.length > 0 && (
          <nav className="cat-nav glass" aria-label="Menu categories">
            {categories.map((category) => (
              <a key={category.id} href={`#category-${category.id}`} className={(activeCategory || `category-${categories[0].id}`) === `category-${category.id}` ? 'active' : ''}>{category.name}</a>
            ))}
          </nav>
        )}

        {categories.length === 0 ? (
          <div className="state overlap" style={{ background: 'var(--white)' }}><span className="state-icon"><Icon name="info" /></span><h2>Menu coming soon</h2><p>This kitchen hasn’t added any available dishes yet.</p></div>
        ) : categories.map((category) => (
          <section className="category" id={`category-${category.id}`} key={category.id}>
            <div className="category-head" data-reveal>
              <h2>{category.name}</h2>
              {category.description && <p>{category.description}</p>}
            </div>
            <div className="dish-list">
              {category.menuItems.map((item, index) => {
                const prices = item.variants.map((variant) => Number(variant.price))
                return (
                  <article className="dish" key={item.id} data-reveal style={{ '--d': `${(index % 2) * 90}ms` }}>
                    <div>
                      <h3>{item.name}</h3>
                      {item.description && <p>{item.description}</p>}
                      {(item.isVegetarian || item.isVegan || item.isGlutenFree) && (
                        <div className="tags">
                          {item.isVegetarian && <span className="chip">Vegetarian</span>}
                          {item.isVegan && <span className="chip">Vegan</span>}
                          {item.isGlutenFree && <span className="chip">Gluten free</span>}
                        </div>
                      )}
                      <span className="price">{prices.length ? <><small>from</small>{money(Math.min(...prices))}</> : money(item.basePrice)}</span>
                    </div>
                    <div className="dish-media" style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}>
                      {!item.imageUrl && initial(item.name)}
                      <button className="add" onClick={() => add(item)} aria-label={`Add ${item.name} to cart`}>Add +</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      {choosing && <VariantModal item={choosing} onClose={() => setChoosing(null)} onAdd={(variant) => { addToCart(menu, choosing, variant); setChoosing(null) }} />}
    </main>
  )
}
