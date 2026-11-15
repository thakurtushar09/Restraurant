import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './components/Icon.jsx'
import Modal from './components/Modal.jsx'
import NotificationBell from './components/NotificationBell.jsx'
import HomePage from './pages/HomePage.jsx'
import ExplorePage from './pages/ExplorePage.jsx'
import RestaurantPage from './pages/RestaurantPage.jsx'
import CartPage from './pages/CartPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import OrderDetailPage from './pages/OrderDetailPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordResetPages.jsx'
import VerifyBanner from './components/VerifyBanner.jsx'
import LocationMenu from './components/LocationMenu.jsx'
import ScanModal from './components/ScanModal.jsx'
import TabBar from './components/TabBar.jsx'
import { loadDineIn, saveDineIn, startDineIn, openedFromScan } from './table.js'
import { api, loadCart, saveCart } from './lib.js'
import { loadLocation, saveLocation, addressToLocation } from './geo.js'
import { disablePush } from './push.js'

const RETURN_PAGES = ['cart', 'checkout', 'orders']

function readRoute(pathname = window.location.pathname) {
  if (pathname === '/cart') return { page: 'cart', param: '' }
  if (pathname === '/checkout') return { page: 'checkout', param: '' }
  if (pathname === '/orders') return { page: 'orders', param: '' }
  if (pathname.startsWith('/orders/')) return { page: 'order', param: decodeURIComponent(pathname.slice('/orders/'.length)) }
  if (pathname === '/login' || pathname === '/signup') return { page: 'auth', param: pathname.slice(1) }
  if (pathname.startsWith('/restaurant/')) return { page: 'restaurant', param: decodeURIComponent(pathname.slice('/restaurant/'.length)) }
  if (pathname === '/explore') return { page: 'explore', param: '' }
  if (pathname === '/verify-email') return { page: 'verify', param: '' }
  if (pathname === '/forgot-password') return { page: 'forgot', param: '' }
  if (pathname === '/reset-password') return { page: 'reset', param: '' }
  return { page: 'home', param: '' }
}

const readReturnPage = () => {
  const next = new URLSearchParams(window.location.search).get('next')
  return RETURN_PAGES.includes(next) ? next : 'home'
}

function pathFor(page, param, returnTo) {
  switch (page) {
    case 'cart': return '/cart'
    case 'checkout': return '/checkout'
    case 'orders': return '/orders'
    case 'order': return `/orders/${encodeURIComponent(param)}`
    case 'explore': return '/explore'
    case 'verify': return `/verify-email${window.location.search}`
    case 'forgot': return '/forgot-password'
    case 'reset': return `/reset-password${window.location.search}`
    case 'restaurant': return `/restaurant/${encodeURIComponent(param)}`
    case 'auth': return `/${param === 'signup' ? 'signup' : 'login'}${returnTo && returnTo !== 'home' ? `?next=${returnTo}` : ''}`
    default: return '/'
  }
}

// Opened from a printed QR (/restaurant/<slug>?scan=1): remember the restaurant and tidy the address bar.
function takeScan() {
  const route = readRoute()
  if (route.page !== 'restaurant' || !openedFromScan()) return loadDineIn()
  const dineIn = startDineIn(route.param)
  saveDineIn(dineIn)
  window.history.replaceState({}, '', pathFor('restaurant', route.param))
  return dineIn
}

// Pages that need a signed-in customer.
const PRIVATE_PAGES = ['checkout', 'orders', 'order']

function App() {
  const [route, setRoute] = useState(readRoute)
  const [postAuthPage, setPostAuthPage] = useState(readReturnPage)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState(loadCart)
  const [location, setLocation] = useState(loadLocation)
  const [addresses, setAddresses] = useState(null) // signed-in customer's saved addresses
  const [locationMenuOpen, setLocationMenuOpen] = useState(false)
  const [dineIn, setDineIn] = useState(takeScan) // the restaurant whose QR a guest scanned, if any
  const [scanning, setScanning] = useState(false)
  const [pendingAdd, setPendingAdd] = useState(null)
  const [user, setUser] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [notice, setNotice] = useState(null)
  const searchInputRef = useRef(null)
  const noticeTimer = useRef(null)
  const headerRef = useRef(null)
  const { page, param } = route

  // The header wraps to two rows on phones; sticky bars and dropdowns sit under its real height.
  useEffect(() => {
    const header = headerRef.current
    if (!header || !('ResizeObserver' in window)) return undefined
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--header-h', `${Math.round(header.getBoundingClientRect().height)}px`)
    })
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { saveCart(cart) }, [cart])
  useEffect(() => { saveLocation(location) }, [location])

  // Load saved addresses on sign-in and start from the default one if no spot is chosen yet.
  const userId = user?.id
  useEffect(() => {
    if (!userId) return undefined
    const controller = new AbortController()
    api('/addresses', { signal: controller.signal })
      .then((result) => {
        setAddresses(result.data)
        const fallback = result.data.find((address) => address.isDefault) ?? result.data[0]
        setLocation((current) => {
          if (current?.addressId && !result.data.some((address) => address.id === current.addressId)) return fallback ? addressToLocation(fallback) : null
          return current ?? (fallback ? addressToLocation(fallback) : null)
        })
      })
      .catch((error) => { if (error.name !== 'AbortError') console.error('Could not load addresses:', error) })
    return () => controller.abort()
  }, [userId])

  // On sign-out, forget saved addresses and any location that came from one.
  const forgetAccountLocation = useCallback(() => {
    setAddresses(null)
    setLocation((current) => current?.addressId ? null : current)
  }, [])

  // Scanned in the app: remember the restaurant and open its menu.
  function onScanned(slug) {
    const next = startDineIn(slug)
    setDineIn(next)
    saveDineIn(next)
    setScanning(false)
    navigate('restaurant', slug)
  }

  function leaveDineIn() {
    setDineIn(null)
    saveDineIn(null)
  }

  // Keeps the chosen location in step when its address is edited or deleted.
  const updateAddresses = useCallback((next) => {
    setAddresses(next)
    setLocation((current) => {
      if (!current?.addressId) return current
      const address = next.find((item) => item.id === current.addressId)
      return address ? addressToLocation(address) : null
    })
  }, [])

  // A 401 while signed in means the session was ended elsewhere; drop back to log in.
  useEffect(() => {
    if (!user) return undefined
    const onUnauthorized = (event) => {
      setUser(null)
      forgetAccountLocation()
      window.history.pushState({}, '', '/login')
      setRoute({ page: 'auth', param: 'login' })
      setNotice({ message: event.detail.message, withCartLink: false, orderId: null })
      window.setTimeout(() => setNotice(null), 5000)
    }
    window.addEventListener('app:unauthorized', onUnauthorized)
    return () => window.removeEventListener('app:unauthorized', onUnauthorized)
  }, [user, forgetAccountLocation])

  useEffect(() => {
    const onPopState = () => {
      setRoute(readRoute())
      setPostAuthPage(readReturnPage())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // "/" or Cmd/Ctrl+K focuses search.
  useEffect(() => {
    const onKey = (event) => {
      const target = event.target
      const isEditing = target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
      if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !isEditing)) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Restore session.
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/users/me', { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return null
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.message || 'Could not restore your session')
        return result.user
      })
      .then((currentUser) => { if (currentUser) setUser(currentUser); else forgetAccountLocation() })
      .catch((error) => { if (error.name !== 'AbortError') console.error('Could not restore customer session:', error) })
      .finally(() => { if (!controller.signal.aborted) setSessionChecked(true) })
    return () => controller.abort()
  }, [forgetAccountLocation])

  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0)

  function showNotice(message, withCartLink = false, ms = 2800, orderId = null) {
    window.clearTimeout(noticeTimer.current)
    setNotice({ message, withCartLink, orderId })
    noticeTimer.current = window.setTimeout(() => setNotice(null), ms)
  }

  function navigate(nextPage, nextParam = '', returnTo) {
    window.history.pushState({}, '', pathFor(nextPage, nextParam, returnTo ?? postAuthPage))
    setRoute({ page: nextPage, param: nextParam })
    window.scrollTo({ top: 0 })
  }

  function openAuth(mode, returnTo = 'home') {
    setPostAuthPage(returnTo)
    navigate('auth', mode, returnTo)
  }

  // Signed-out visitors who land on a private page are sent to log in first.
  useEffect(() => {
    if (sessionChecked && !user && PRIVATE_PAGES.includes(page)) {
      const returnTo = page === 'order' ? 'orders' : page
      window.history.replaceState({}, '', pathFor('auth', 'login', returnTo))
      Promise.resolve().then(() => {
        setPostAuthPage(returnTo)
        setRoute({ page: 'auth', param: 'login' })
      })
    }
  }, [sessionChecked, user, page])

  function onAuthenticated(nextUser) {
    setUser(nextUser)
    navigate(postAuthPage === 'home' ? 'home' : postAuthPage)
    showNotice(`Welcome${nextUser?.fullName ? `, ${nextUser.fullName.split(' ')[0]}` : ''}!`)
  }

  async function signOut() {
    try {
      // Stop pushes to this device for the account that's leaving.
      await disablePush().catch(() => {})
      await fetch('/api/v1/users/logout', { method: 'POST' })
    } finally {
      setUser(null)
      forgetAccountLocation()
      navigate('home')
      showNotice('You’ve been signed out.')
    }
  }

  // A cart holds dishes from one restaurant, since an order goes to a single kitchen.
  function addToCart(menu, item, variant) {
    const branch = {
      id: menu.id,
      slug: menu.publicSlug,
      branchName: menu.branchName,
      groupName: menu.restaurantGroup.groupName,
      acceptsDelivery: menu.acceptsDelivery,
      acceptsDineIn: menu.acceptsDineIn,
      openingHours: menu.openingHours ?? null,
      timezone: menu.timezone,
      averagePreparationTimeMinutes: menu.averagePreparationTimeMinutes,
      latitude: menu.latitude ?? null,
      longitude: menu.longitude ?? null,
      deliveryRadiusKm: menu.deliveryRadiusKm ?? null,
    }
    const line = {
      key: `${item.id}:${variant?.id ?? ''}`,
      menuItemId: item.id,
      variantId: variant?.id ?? null,
      name: item.name,
      variantName: variant?.name ?? null,
      price: Number(variant?.price ?? item.basePrice),
      image: item.imageUrl ?? '',
      quantity: 1,
    }
    if (cart.items.length && cart.branch?.id !== branch.id) {
      setPendingAdd({ branch, line })
      return
    }
    commitAdd(branch, line, false)
  }

  function commitAdd(branch, line, replace) {
    setCart((current) => {
      const base = replace || current.branch?.id !== branch.id ? { branch, items: [] } : { ...current, branch }
      const found = base.items.find((existing) => existing.key === line.key)
      return {
        ...base,
        items: found
          ? base.items.map((existing) => existing.key === line.key ? { ...existing, quantity: existing.quantity + 1 } : existing)
          : [...base.items, line],
      }
    })
    showNotice(`${line.name} added to your cart`, true)
  }

  function changeQuantity(key, amount) {
    setCart((current) => {
      const items = current.items.map((item) => item.key === key ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0)
      return items.length ? { ...current, items } : { branch: null, items: [] }
    })
  }

  function onOrderPlaced(order) {
    setCart({ branch: null, items: [] })
    navigate('order', order.id)
    showNotice(order.fulfillmentType === 'DINE_IN' ? 'Pre-order confirmed — see you soon!' : 'Order placed!', false, 3600)
  }

  const link = (target) => (event) => { event.preventDefault(); navigate(target) }
  const markVerified = useCallback(() => setUser((current) => current && { ...current, isEmailVerified: true }), [])

  return (
    <>
      <header className="header" ref={headerRef}>
        <div className="wrap header-inner">
          <a className="wordmark" href="/" onClick={link('home')} aria-label="CraveQ home">
            <strong>CraveQ</strong><small>good food, good days</small>
          </a>
          <LocationMenu
            user={user}
            addresses={addresses}
            onAddressesChange={updateAddresses}
            location={location}
            setLocation={setLocation}
            openAuth={openAuth}
            open={locationMenuOpen}
            setOpen={setLocationMenuOpen}
          />
          <label className="search">
            <Icon name="search" size={17} />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => { setSearch(event.target.value); if (page !== 'explore') navigate('explore') }}
              placeholder="Search kitchens, dishes or cities"
              aria-label="Search restaurants, dishes and cities"
            />
            <kbd>/</kbd>
          </label>
          <nav className="nav" aria-label="Main navigation">
            <a href="/explore" className={page === 'explore' || page === 'restaurant' ? 'active' : ''} onClick={link('explore')}>Explore</a>
            {user ? <>
              <a href="/orders" className={page === 'orders' || page === 'order' ? 'active' : ''} onClick={link('orders')}>My orders</a>
              <button className="nav-btn" onClick={signOut}>Sign out</button>
            </> : <>
              <a href="/login" onClick={(event) => { event.preventDefault(); openAuth('login') }}>Log in</a>
              <button className="btn btn-ghost btn-sm" onClick={() => openAuth('signup')}>Sign up</button>
            </>}
          </nav>
          <button className="scan-btn" onClick={() => setScanning(true)} aria-label="Scan a table QR code" title="Scan table QR"><Icon name="scan" size={18} /></button>
          {user && <NotificationBell key={user.id} navigate={navigate} onNotify={(notification) => showNotice(notification.title, false, 5000, notification.orderId)} />}
          <button className="cart-btn" onClick={() => navigate('cart')} aria-label={`Open cart, ${count} items`}>
            <Icon name="bag" size={17} /><span className="label">Cart</span><span className="count" key={count}>{count}</span>
          </button>
        </div>
      </header>

      {user && !user.isEmailVerified && page !== 'verify' && <VerifyBanner email={user.email} notify={showNotice} />}

      {page === 'verify' ? (
        sessionChecked ? <VerifyEmailPage signedIn={Boolean(user)} onVerified={markVerified} navigate={navigate} /> : <main className="wrap" style={{ padding: 56 }}><div className="skeleton" style={{ height: 240 }} /></main>
      ) : page === 'forgot' ? (
        <ForgotPasswordPage onBack={() => navigate('auth', 'login')} />
      ) : page === 'reset' ? (
        <ResetPasswordPage onDone={onAuthenticated} onForgot={() => navigate('forgot')} />
      ) : page === 'auth' ? (
        <AuthPage key={param} onForgot={() => navigate('forgot')} mode={param === 'signup' ? 'signup' : 'login'} onSwitch={(mode) => navigate('auth', mode)} onBack={() => navigate(postAuthPage === 'checkout' ? 'cart' : postAuthPage)} onAuthenticated={onAuthenticated} />
      ) : page === 'cart' ? (
        <CartPage cart={cart} user={user} navigate={navigate} openAuth={openAuth} changeQuantity={changeQuantity} />
      ) : page === 'checkout' ? (
        user ? <CheckoutPage cart={cart} user={user} navigate={navigate} onPlaced={onOrderPlaced} dineIn={dineIn} location={location} setLocation={setLocation} addresses={addresses} onAddressesChange={updateAddresses} /> : <main className="wrap" style={{ padding: 56 }}><div className="skeleton" style={{ height: 240 }} /></main>
      ) : page === 'orders' ? (
        user ? <OrdersPage navigate={navigate} onSignOut={signOut} /> : <main className="wrap" style={{ padding: 56 }}><div className="skeleton" style={{ height: 240 }} /></main>
      ) : page === 'order' ? (
        user ? <OrderDetailPage key={param} orderId={param} navigate={navigate} notify={showNotice} /> : <main className="wrap" style={{ padding: 56 }}><div className="skeleton" style={{ height: 240 }} /></main>
      ) : page === 'explore' ? (
        <ExplorePage search={search} setSearch={setSearch} openRestaurant={(slug) => navigate('restaurant', slug)} location={location} setLocation={setLocation} openLocationMenu={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setLocationMenuOpen(true) }} />
      ) : page === 'restaurant' ? (
        <RestaurantPage key={param} slug={param} navigate={navigate} addToCart={addToCart} location={location} dineIn={dineIn} onLeaveDineIn={leaveDineIn} />
      ) : (
        <HomePage navigate={navigate} openRestaurant={(slug) => navigate('restaurant', slug)} location={location} onScan={() => setScanning(true)} dineIn={dineIn} />
      )}

      {!['auth', 'forgot', 'reset'].includes(page) && (
        <footer className="footer dark">
          <div className="band-glow" aria-hidden="true" />
          <div className="wrap footer-inner">
            <div className="footer-brand">
              <a className="wordmark" href="/" onClick={link('home')}><strong>CraveQ</strong><small>good food, good days</small></a>
              <p className="tagline">Pre-order from local kitchens and walk in to a meal that’s ready when you are.</p>
            </div>
            <nav className="col" aria-label="Discover">
              <h4>Discover</h4>
              <a href="/explore" onClick={link('explore')}>Explore kitchens</a>
              <a href="/#how-it-works" onClick={(event) => { event.preventDefault(); navigate('home'); window.setTimeout(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }), 50) }}>How it works</a>
            </nav>
            <nav className="col" aria-label="Your account">
              <h4>Your account</h4>
              {user ? <a href="/orders" onClick={link('orders')}>My orders</a> : <a href="/login" onClick={(event) => { event.preventDefault(); openAuth('login') }}>Log in</a>}
              <a href="/cart" onClick={link('cart')}>Cart</a>
            </nav>
            <div className="legal"><span>© {new Date().getFullYear()} CraveQ</span><span>Good days are made around the table.</span></div>
          </div>
        </footer>
      )}

      {!['auth', 'forgot', 'reset'].includes(page) && (
        <TabBar page={page} user={user} count={count} navigate={navigate} openAuth={openAuth} onScan={() => setScanning(true)} />
      )}

      {scanning && <ScanModal onClose={() => setScanning(false)} onSlug={onScanned} />}

      {pendingAdd && (
        <Modal title="Start a new cart?" onClose={() => setPendingAdd(null)}>
          <p className="hint">Your cart has dishes from {cart.branch.groupName} · {cart.branch.branchName}. An order goes to one kitchen, so adding this will clear them.</p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setPendingAdd(null)}>Keep my cart</button>
            <button className="btn btn-primary" onClick={() => { commitAdd(pendingAdd.branch, pendingAdd.line, true); setPendingAdd(null) }}>Start new cart</button>
          </div>
        </Modal>
      )}

      {notice && (
        <div className="toast" role="status">
          {notice.message}
          {notice.withCartLink && page !== 'cart' && <button onClick={() => navigate('cart')}>View cart</button>}
          {notice.orderId && !(page === 'order' && param === notice.orderId) && <button onClick={() => { setNotice(null); navigate('order', notice.orderId) }}>View</button>}
        </div>
      )}
    </>
  )
}

export default App
