import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './Explore.css'
import './Cart.css'
import './Navbar.css'

const kitchens = [
  { name: 'Bowl & Bloom', kind: 'Fresh bowls', mark: 'bowl', className: 'logo-bloom' },
  { name: 'Sunday Loaf', kind: 'Bakery & brunch', mark: 'loaf', className: 'logo-loaf' },
  { name: 'Pasta Social', kind: 'Pasta kitchen', mark: 'pasta', className: 'logo-pasta' },
  { name: 'Sugarplum', kind: 'Sweet treats', mark: 'sweet', className: 'logo-sugar' },
]

function Icon({ name, size = 20 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  if (name === 'bag') return <svg {...common}><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>
  if (name === 'arrow') return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
  if (name === 'search') return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
  if (name === 'pin') return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  if (name === 'leaf') return <svg {...common}><path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-7 10-16Z"/><path d="M4 21c3-5 6-8 11-11"/></svg>
  return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16"/></svg>
}

function getPage(pathname) {
  if (pathname === '/cart') return 'cart'
  if (pathname === '/login' || pathname === '/signup') return 'auth'
  if (pathname.startsWith('/restaurant/')) return 'restaurant'
  if (pathname === '/explore') return 'explore'
  return 'home'
}

function getAuthMode(pathname) {
  return pathname === '/signup' ? 'signup' : 'login'
}

function getRestaurantSlug(pathname) {
  return pathname.startsWith('/restaurant/') ? decodeURIComponent(pathname.slice('/restaurant/'.length)) : ''
}

function App() {
  const [search, setSearch] = useState('')
  const searchInputRef = useRef(null)
  const [city, setCity] = useState('')
  const [fulfillment, setFulfillment] = useState('')
  const [cart, setCart] = useState([])
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(getPage(window.location.pathname))
  const [authMode, setAuthMode] = useState(getAuthMode(window.location.pathname))
  const [postAuthPage, setPostAuthPage] = useState(new URLSearchParams(window.location.search).get('next') === 'cart' ? 'cart' : 'home')
  const [user, setUser] = useState(null)
  const [authFullName, setAuthFullName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [activeSlug, setActiveSlug] = useState(getRestaurantSlug(window.location.pathname))
  const [restaurants, setRestaurants] = useState([])
  const [restaurantsLoading, setRestaurantsLoading] = useState(false)
  const [restaurantsError, setRestaurantsError] = useState('')
  const [reloadRestaurants, setReloadRestaurants] = useState(0)
  const [restaurantMenu, setRestaurantMenu] = useState(null)
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState('')

  useEffect(() => {
    const onPopState = () => {
      setPage(getPage(window.location.pathname))
      setActiveSlug(getRestaurantSlug(window.location.pathname))
      setAuthMode(getAuthMode(window.location.pathname))
      setPostAuthPage(new URLSearchParams(window.location.search).get('next') === 'cart' ? 'cart' : 'home')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const onSearchShortcut = (event) => {
      const target = event.target
      const isEditing = target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      } else if (event.key === '/' && !isEditing) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onSearchShortcut)
    return () => window.removeEventListener('keydown', onSearchShortcut)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/users/me', { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return null
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.message || 'Could not restore your session')
        return result.user
      })
      .then((currentUser) => { if (currentUser) setUser(currentUser) })
      .catch((error) => { if (error.name !== 'AbortError') console.error('Could not restore customer session:', error) })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (page !== 'explore') return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setRestaurantsLoading(true)
      setRestaurantsError('')
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (city.trim()) params.set('city', city.trim())
      if (fulfillment) params.set('fulfillment', fulfillment)
      try {
        const response = await fetch(`/api/v1/public/branches?${params}`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.message || 'Could not load restaurants')
        setRestaurants(result.data)
      } catch (error) {
        if (error.name !== 'AbortError') setRestaurantsError(error.message || 'Could not load restaurants')
      } finally {
        if (!controller.signal.aborted) setRestaurantsLoading(false)
      }
    }, 220)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [page, search, city, fulfillment, reloadRestaurants])

  useEffect(() => {
    if (page !== 'restaurant' || !activeSlug) return undefined
    const controller = new AbortController()
    Promise.resolve().then(() => {
      setMenuLoading(true)
      setMenuError('')
      return fetch(`/api/v1/public/branches/${encodeURIComponent(activeSlug)}/menu`, { signal: controller.signal })
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.message || 'Could not load this restaurant')
        setRestaurantMenu(result.data)
      })
      .catch((error) => { if (error.name !== 'AbortError') setMenuError(error.message || 'Could not load this restaurant') })
      .finally(() => { if (!controller.signal.aborted) setMenuLoading(false) })
    return () => controller.abort()
  }, [page, activeSlug])

  const visibleKitchens = useMemo(() => {
    const query = search.trim().toLowerCase()
    return kitchens.filter((kitchen) => !query || `${kitchen.name} ${kitchen.kind}`.toLowerCase().includes(query))
  }, [search])

  useEffect(() => {
    const revealItems = document.querySelectorAll('.scroll-reveal:not(.is-visible)')
    if (!('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'))
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.18, rootMargin: '0px 0px -35px 0px' })
    revealItems.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [page, search])
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const restaurantNames = [...new Set(cart.map((item) => item.restaurant).filter(Boolean))]
  const receiptRestaurantName = restaurantNames.length === 1 ? restaurantNames[0] : restaurantNames.length > 1 ? 'Multiple restaurants' : 'Local kitchen'

  function navigate(nextPage, slug = '', returnTo) {
    const authReturnPage = returnTo ?? postAuthPage
    const path = nextPage === 'cart' ? '/cart' : nextPage === 'auth' ? `/${slug === 'signup' ? 'signup' : 'login'}${authReturnPage === 'cart' ? '?next=cart' : ''}` : nextPage === 'explore' ? '/explore' : nextPage === 'restaurant' ? `/restaurant/${encodeURIComponent(slug)}` : '/'
    window.history.pushState({}, '', path)
    setPage(nextPage)
    setActiveSlug(slug)
    if (nextPage === 'auth') setAuthMode(slug === 'signup' ? 'signup' : 'login')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openAuth(mode, returnTo = 'home') {
    setPostAuthPage(returnTo)
    navigate('auth', mode, returnTo)
  }

  async function submitAuth(event) {
    event.preventDefault()
    setAuthError('')
    if (authMode === 'signup' && authPassword.length < 8) {
      setAuthError('Choose a password with at least 8 characters.')
      return
    }
    setAuthSubmitting(true)
    try {
      const response = await fetch(`/api/v1/users/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authMode === 'signup'
          ? { fullName: authFullName, email: authEmail, password: authPassword }
          : { email: authEmail, password: authPassword }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.message || 'We could not sign you in')
      setUser(result.user)
      setAuthPassword('')
      if (postAuthPage === 'cart') {
        navigate('cart')
        setNotice('You’re signed in. Checkout is coming soon, and your cart is saved.')
      } else {
        navigate('home')
        setNotice(`Welcome${result.user?.fullName ? `, ${result.user.fullName.split(' ')[0]}` : ''}!`)
      }
      window.setTimeout(() => setNotice(''), 3200)
    } catch (error) {
      setAuthError(error.message || 'Something went wrong. Please try again.')
    } finally {
      setAuthSubmitting(false)
    }
  }

  async function signOut() {
    try {
      await fetch('/api/v1/users/logout', { method: 'POST' })
    } finally {
      setUser(null)
      navigate('home')
      setNotice('You’ve been signed out.')
      window.setTimeout(() => setNotice(''), 2600)
    }
  }

  function addToCart(dish, restaurantName = '') {
    const item = { ...dish, image: dish.image || dish.imageUrl || '', price: Number(dish.basePrice ?? dish.price), restaurant: restaurantName || dish.restaurant || '' }
    setCart((current) => {
      const found = current.find((existing) => existing.id === item.id)
      return found ? current.map((existing) => existing.id === item.id ? { ...existing, quantity: existing.quantity + 1 } : existing) : [...current, { ...item, quantity: 1 }]
    })
    setNotice(`${dish.name} added to your cart`)
    window.setTimeout(() => setNotice(''), 2200)
  }

  function changeQuantity(id, amount) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0))
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate('home') }} aria-label="Name home">
          <span className="brand-mark"><Icon name="leaf" size={22} /></span><span className="brand-copy"><strong>Name</strong><small>good food, good days</small></span>
        </a>
        <label className="header-search"><Icon name="search" size={18} /><input ref={searchInputRef} value={search} onChange={(event) => { setSearch(event.target.value); if (page !== 'explore') navigate('explore') }} placeholder="Find a kitchen or dish" aria-label="Search restaurants, kitchens, and cities" /><kbd>/</kbd></label>
        <nav className="nav-links" aria-label="Main navigation"><a className={`nav-explore${page === 'explore' || page === 'restaurant' ? ' active' : ''}`} href="/explore" aria-current={page === 'explore' || page === 'restaurant' ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate('explore') }}>Explore</a>{user ? <><span className="customer-greeting">Hi, {user.fullName.split(' ')[0]}</span><button className="nav-text-button" onClick={signOut}>Sign out</button></> : <><a className="nav-login" href="/login" onClick={(event) => { event.preventDefault(); openAuth('login') }}>Log in</a><button className="nav-signup" onClick={() => openAuth('signup')}>Sign up <span aria-hidden="true">↗</span></button></>}</nav>
        <button className="bag-button" onClick={() => navigate('cart')} aria-label={`Open cart, ${count} items`}><Icon name="bag" size={18} /><span className="bag-label">Cart</span><span className="bag-count">{count}</span></button>
      </header>

      {page === 'auth' ? (
        <main className="auth-page">
          <section className="auth-visual">
            <div className="auth-visual-shade" />
            <div className="auth-visual-brand"><span className="brand-mark"><Icon name="leaf" size={22}/></span><span>Name</span></div>
            <div className="auth-visual-copy"><span className="eyebrow">Good food brings us together</span><h1>A little closer<br/>to <em>something lovely.</em></h1><p>Discover the kitchens and flavours that make your neighbourhood feel like yours.</p></div>
            <div className="auth-visual-caption"><span>✳</span> MADE FOR GOOD DAYS</div>
          </section>
          <section className="auth-panel">
            <button className="back-link auth-back" onClick={() => navigate(postAuthPage === 'cart' ? 'cart' : 'home')}>← <span>Back</span></button>
            <div className="auth-form-wrap">
              <span className="eyebrow">{authMode === 'signup' ? 'Your table is waiting' : 'Welcome back'}</span>
              <h2>{authMode === 'signup' ? 'Make yourself at home.' : 'Good to see you again.'}</h2>
              <p className="auth-intro">{authMode === 'signup' ? 'Create an account to save your details and make checkout easier.' : 'Sign in to continue with your account and saved details.'}</p>
              <form className="auth-form" onSubmit={submitAuth}>
                {authMode === 'signup' && <label>Your name<input type="text" autoComplete="name" value={authFullName} onChange={(event) => setAuthFullName(event.target.value)} placeholder="How should we call you?" required/></label>}
                <label>Email address<input type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" required/></label>
                <label>Password<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder={authMode === 'signup' ? 'At least 8 characters' : 'Enter your password'} minLength={authMode === 'signup' ? 8 : 1} required/></label>
                {authError && <p className="auth-error" role="alert">{authError}</p>}
                <button className="button button-dark auth-submit" type="submit" disabled={authSubmitting}>{authSubmitting ? 'One moment…' : authMode === 'signup' ? 'Create your account' : 'Log in'}<Icon name="arrow" size={17}/></button>
              </form>
              <p className="auth-switch">{authMode === 'signup' ? 'Already have an account?' : 'New around here?'} <button onClick={() => navigate('auth', authMode === 'signup' ? 'login' : 'signup')}>{authMode === 'signup' ? 'Log in' : 'Create an account'}</button></p>
              <div className="guest-note"><Icon name="bag" size={17}/><span>You can browse and add to your cart without signing in. Sign in is needed before checkout.</span></div>
            </div>
            <span className="auth-panel-footer">Thoughtful food from good local kitchens.</span>
          </section>
        </main>
      ) : page === 'cart' ? (
        <main className="cart-page">
          <button className="back-link" onClick={() => navigate('home')}>← <span>Back to exploring</span></button>
          <div className="cart-page-heading"><span className="eyebrow">Your next good meal</span><h1>Your <em>cart.</em></h1><p>Everything you’ve picked, all in one place.</p></div>
          {cart.length === 0 ? <div className="cart-empty"><span>✳</span><h2>Nothing in your cart just yet.</h2><p>Explore kitchens and add something delicious when you find it.</p><button className="button button-dark" onClick={() => navigate('explore')}>Explore food <Icon name="arrow" size={17}/></button></div> : <div className="cart-layout"><div className="cart-items">{cart.map((item) => <article className="cart-item" key={item.id}><div className="mini-photo" style={item.image ? { backgroundImage: `url(${item.image})` } : undefined}/><div className="cart-item-copy"><strong>{item.name}</strong><span className="cart-restaurant">{item.restaurant}</span><span>₹{item.price}</span><div className="quantity-control"><button onClick={() => changeQuantity(item.id, -1)} aria-label={`Remove one ${item.name}`}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)} aria-label={`Add one ${item.name}`}>+</button></div></div></article>)}</div><aside className="cart-summary receipt-card">
              <div className="receipt-topline">
                <div className="receipt-brand"><span><Icon name="leaf" size={17}/></span><div><strong>{receiptRestaurantName}</strong><small>ORDER RECEIPT</small></div></div>
                <span className="receipt-ticket">BAG · {String(count).padStart(2, '0')}</span>
              </div>
              <div className="receipt-title"><h2>Your order</h2><span>{count} {count === 1 ? 'item' : 'items'}</span></div>
              <div className="receipt-rule"/>
              <div className="receipt-items">{cart.map((item) => <div className="receipt-item" key={item.id}><span><b>{String(item.quantity).padStart(2, '0')}</b><span>{item.name}</span></span><strong>₹{item.price * item.quantity}</strong></div>)}</div>
              <div className="receipt-rule"/>
              <div className="receipt-totals"><div><span>Delivery</span><span>Calculated later</span></div></div>
              <div className="receipt-grand-total"><span>Food subtotal</span><strong>₹{total}</strong></div>
              <p className="receipt-note">{user ? 'Checkout is not available yet. Your cart is ready for when it is.' : 'You can build your cart as a guest. Sign in is required before checkout.'}</p>
              <button className="button button-dark checkout-button" disabled={Boolean(user)} onClick={() => openAuth('login', 'cart')}>{user ? 'Checkout coming soon' : 'Sign in to continue'} {!user && <Icon name="arrow" size={17}/>}</button>
              <div className="receipt-thanks"><span>✳</span> THANK YOU FOR EATING LOCAL <span>✳</span></div>
            </aside></div>}
        </main>
      ) : page === 'explore' ? (
        <main className="explore-page">
          <section className="explore-intro"><button className="back-link" onClick={() => navigate('home')}>← <span>Back home</span></button><div className="explore-title"><span className="eyebrow"><span className="eyebrow-dot"/> Discover your neighbourhood</span><h1>Find your next<br/><em>favourite table.</em></h1><p>Meet the independent kitchens around you. Find something delicious, then choose delivery or pickup on your schedule.</p></div></section>
          <section className="explore-controls" aria-label="Restaurant filters"><label className="city-filter"><Icon name="pin" size={17}/><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Filter by city" aria-label="Filter restaurants by city"/></label><div className="fulfillment-filters" aria-label="Fulfillment type"><button className={!fulfillment ? 'selected' : ''} onClick={() => setFulfillment('')}>All options</button><button className={fulfillment === 'DELIVERY' ? 'selected' : ''} onClick={() => setFulfillment(fulfillment === 'DELIVERY' ? '' : 'DELIVERY')}>Delivery</button><button className={fulfillment === 'PICKUP' ? 'selected' : ''} onClick={() => setFulfillment(fulfillment === 'PICKUP' ? '' : 'PICKUP')}>Pickup</button></div><span className="explore-result-count">{restaurantsLoading ? 'Finding kitchens…' : `${restaurants.length} ${restaurants.length === 1 ? 'kitchen' : 'kitchens'}`}</span></section>
          {restaurantsError ? <div className="explore-state"><span>✳</span><h2>We couldn’t load restaurants.</h2><p>{restaurantsError}</p><button className="button button-dark" onClick={() => setReloadRestaurants((value) => value + 1)}>Try again <Icon name="arrow" size={16}/></button></div> : restaurantsLoading && restaurants.length === 0 ? <div className="explore-state loading-state"><span className="loader-orbit">✳</span><p>Finding good food around you…</p></div> : restaurants.length === 0 ? <div className="explore-state"><span>✳</span><h2>No kitchens found yet.</h2><p>Try a different search or city. We’ll keep looking.</p><button className="text-link" onClick={() => { setSearch(''); setCity(''); setFulfillment('') }}>Clear filters</button></div> : <div className="restaurant-grid">{restaurants.map((restaurant, index) => {
            const cover = restaurant.menuItems.find((item) => item.imageUrl)?.imageUrl
            const initials = restaurant.restaurantGroup.groupName.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
            return <article className="restaurant-card" key={restaurant.id} style={{ '--card-index': index }} onClick={() => navigate('restaurant', restaurant.publicSlug)} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter') navigate('restaurant', restaurant.publicSlug) }}>
              <div className="restaurant-cover" style={cover ? { backgroundImage: `linear-gradient(180deg, #192c2410 35%, #192c2460), url(${cover})` } : undefined}>{restaurant.restaurantGroup.logoUrl ? <img className="restaurant-logo" src={restaurant.restaurantGroup.logoUrl} alt={`${restaurant.restaurantGroup.groupName} logo`} /> : <span className="restaurant-monogram">{initials}</span>}<span className="restaurant-prep"><Icon name="clock" size={14}/>{restaurant.averagePreparationTimeMinutes} min prep</span><span className="cover-caption">Made by {restaurant.restaurantGroup.groupName}</span></div>
              <div className="restaurant-card-body"><div className="restaurant-card-title"><div><span className="restaurant-group-name">{restaurant.restaurantGroup.groupName}</span><h2>{restaurant.branchName}</h2></div><span className="restaurant-item-count">{restaurant._count.menuItems} items</span></div><p className="restaurant-location"><Icon name="pin" size={14}/>{restaurant.city}, {restaurant.state}</p><div className="restaurant-fulfillment">{restaurant.acceptsDelivery && <span>Delivery</span>}{restaurant.acceptsPickup && <span>Pickup</span>}</div>{restaurant.menuItems.length > 0 && <div className="restaurant-menu-preview">{restaurant.menuItems.slice(0, 2).map((item) => <span key={item.name}>{item.name}</span>)}</div>}<button className="restaurant-open" onClick={(event) => { event.stopPropagation(); navigate('restaurant', restaurant.publicSlug) }}>Explore kitchen <Icon name="arrow" size={15}/></button></div>
            </article>
          })}</div>}
        </main>
      ) : page === 'restaurant' ? (
        <main className="restaurant-page">
          <button className="back-link" onClick={() => navigate('explore')}>← <span>All kitchens</span></button>
          {menuLoading ? <div className="explore-state loading-state"><span className="loader-orbit">✳</span><p>Loading the menu…</p></div> : menuError ? <div className="explore-state"><span>✳</span><h2>This kitchen is unavailable.</h2><p>{menuError}</p><button className="button button-dark" onClick={() => navigate('explore')}>Back to Explore</button></div> : restaurantMenu && <>
            <section className="restaurant-detail-hero">
              <div className="detail-logo-wrap">{restaurantMenu.restaurantGroup.logoUrl ? <img src={restaurantMenu.restaurantGroup.logoUrl} alt=""/> : <span>{restaurantMenu.restaurantGroup.groupName.slice(0, 1)}</span>}</div>
              <div className="detail-hero-copy">
                <span className="eyebrow"><span className="eyebrow-dot"/> {restaurantMenu.restaurantGroup.groupName}</span>
                <h1>{restaurantMenu.branchName}</h1>
                <p className="detail-location"><Icon name="pin" size={15}/>{[restaurantMenu.addressLine1, restaurantMenu.city, restaurantMenu.state].filter(Boolean).join(', ')}</p>
                <div className="restaurant-detail-meta"><span><Icon name="clock" size={15}/>{restaurantMenu.averagePreparationTimeMinutes} min prep</span>{restaurantMenu.acceptsDelivery && <span>Delivery</span>}{restaurantMenu.acceptsPickup && <span>Pickup</span>}</div>
              </div>
              <div className="detail-hero-aside"><span className="detail-aside-flower">✳</span><span>GOOD FOOD<br/>MADE NEARBY</span></div>
            </section>
            {restaurantMenu.categories.length > 0 && <nav className="category-jump-nav" aria-label="Menu categories">{restaurantMenu.categories.map((category) => <a key={category.id} href={`#category-${category.id}`}>{category.name}</a>)}</nav>}
            <div className="restaurant-menu-heading"><span className="eyebrow">From {restaurantMenu.restaurantGroup.groupName}</span><h2>Made for <em>your table.</em></h2></div>
            {restaurantMenu.categories.length === 0 ? <div className="explore-state"><h2>Menu coming soon</h2><p>This kitchen hasn’t added any available dishes yet.</p></div> : restaurantMenu.categories.map((category) => <section className="menu-category" id={`category-${category.id}`} key={category.id}>
              <div className="category-heading"><span className="category-marker">✳</span><div><h2>{category.name}</h2>{category.description && <p>{category.description}</p>}</div></div>
              <div className="menu-item-list">{category.menuItems.map((item) => <article className="menu-item-card" key={item.id}>
                <div className="menu-item-visual">{item.imageUrl ? <img src={item.imageUrl} alt=""/> : <span>✳</span>}</div>
                <div className="menu-item-description"><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}<div className="menu-item-details">{item.isVegetarian && <span>Vegetarian</span>}{item.isVegan && <span>Vegan</span>}{item.isGlutenFree && <span>Gluten free</span>}</div><strong>₹{Number(item.basePrice).toFixed(0)}</strong></div>
                <button className="add-button" onClick={() => addToCart(item, restaurantMenu.restaurantGroup.groupName)} aria-label={`Add ${item.name} to cart`}>+</button>
              </article>)}</div>
            </section>)}
          </>}
        </main>
      ) : (
        <main>
          <section className="hero" id="home">
            <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot" /> Your neighbourhood, on the table</span><h1>Good food.<br/><em>On your time.</em></h1><p>Discover local kitchens, find your next favourite, and get it delivered or ready for pickup when it suits you.</p><div className="hero-actions"><a className="button button-dark" href="/explore" onClick={(event) => { event.preventDefault(); navigate('explore') }}>Find something good <Icon name="arrow" size={17}/></a><a className="text-link" href="#how-it-works">How it works <span>↗</span></a></div><div className="hero-notes"><span><Icon name="leaf" size={17}/> Independent local kitchens</span><span><Icon name="clock" size={17}/> Order now or for later</span></div></div>
            <div className="hero-visual"><div className="hero-photo" role="img" aria-label="A colourful meal ready to share"/><div className="photo-stamp"><span>Good food</span><strong>from your<br/>neighbourhood</strong><span className="stamp-leaf"><Icon name="leaf" size={18}/></span></div><div className="hero-caption"><span>Made nearby, picked by you</span><span>01 / 04</span></div></div><div className="hero-scribble" aria-hidden="true">✳</div>
          </section>

          <section className="discovery-section" id="menu">
            <span id="how-it-works" className="section-anchor" />
            <div className="discovery-copy scroll-reveal">
              <span className="eyebrow"><span className="eyebrow-dot" /> Around the corner, around the table</span>
              <h2>Good food has<br/>a way of <em>bringing us</em><br/><em>together.</em></h2>
              <p>From a slow Sunday brunch to a midweek pick-me-up, find independent kitchens with something lovely cooking.</p>
              <span className="discovery-note"><span className="note-spark">✳</span> Four demo kitchens to get us started</span>
            </div>
            <div className="kitchen-showcase">
              <div className="showcase-heading scroll-reveal"><span className="eyebrow">A few good places</span><span className="showcase-line"/><span className="showcase-index">01 — 04</span></div>
              <div className="kitchen-logos" aria-live="polite">
                {visibleKitchens.map((kitchen, index) => <article className={`kitchen-logo scroll-reveal ${kitchen.className}`} style={{ '--reveal-delay': `${index * 130}ms` }} key={kitchen.name}>
                  <span className={`demo-mark ${kitchen.mark}`} aria-hidden="true">{kitchen.mark === 'bowl' ? '◒' : kitchen.mark === 'loaf' ? '✿' : kitchen.mark === 'pasta' ? '〰' : '✳'}</span>
                  <span className="demo-wordmark">{kitchen.name}</span><span className="demo-kind">{kitchen.kind}</span><span className="logo-arrow" aria-hidden="true">↗</span>
                </article>)}
              </div>
              {visibleKitchens.length === 0 && <p className="kitchen-empty">No demo kitchens match “{search}”. Try “bowl”, “bakery”, “pasta”, or “sweet”.</p>}
              <div className="showcase-foot scroll-reveal"><span>Independent kitchens, each with their own flavour.</span><span className="showcase-foot-mark"><Icon name="leaf" size={15}/> GOOD THINGS GROW LOCAL</span></div>
            </div>
            <div className="discovery-orbit" aria-hidden="true"><span>GOOD<br/>FOOD</span><i>✳</i></div>
          </section>
        </main>
      )}

      <footer className="footer"><a className="brand footer-brand" href="/" onClick={(event) => { event.preventDefault(); navigate('home') }}><span className="brand-mark"><Icon name="leaf" size={19}/></span><span className="brand-copy"><strong>Name</strong><small>good food, good days</small></span></a><span>Good days are made around the table.</span><div><a href="/explore" onClick={(event) => { event.preventDefault(); navigate('explore') }}>Explore food</a><a href="/#how-it-works" onClick={(event) => { event.preventDefault(); navigate('home'); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }) }}>How it works</a></div><small>© 2026 Name</small></footer>
      {notice && <div className="toast" role="status">{notice}{<button onClick={() => navigate('cart')}>View cart</button>}</div>}
    </div>
  )
}

export default App
