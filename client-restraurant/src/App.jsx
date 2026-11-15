import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from './components/Icon.jsx'
import Toasts from './components/Toasts.jsx'
import BranchDrawer from './components/BranchDrawer.jsx'
import NotificationBell from './components/NotificationBell.jsx'
import { disablePush } from './push.js'
import AuthPage from './pages/AuthPage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import OverviewPage from './pages/OverviewPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import ManagePage from './pages/ManagePage.jsx'
import KitchenPage from './pages/KitchenPage.jsx'
import DeliveriesPage from './pages/DeliveriesPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import VerifyEmailPage from './pages/VerifyEmailPage.jsx'
import SetPasswordPage from './pages/SetPasswordPage.jsx'
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordResetPages.jsx'
import VerifyBanner from './components/VerifyBanner.jsx'
import { api, toast, buildWorkspaces, canManageMenu, canManageGroup, canUseKitchen, canUseDeliveries, homePageFor, initials, clock, ROLE_LABELS } from './lib.js'

const POLL_MS = 15000
const BRANCH_KEY = 'kitchen:branch'

// Each role gets its own set of pages; `nav: false` pages are reached from the user menu.
const PAGES = {
  overview: { title: 'Overview', icon: 'grid', allowed: canManageMenu },
  orders: { title: 'Orders', icon: 'receipt', allowed: canManageMenu },
  kitchen: { title: 'Kitchen', icon: 'chef', allowed: canUseKitchen },
  deliveries: { title: 'Deliveries', icon: 'bike', allowed: (role, workspace) => role === 'DELIVERY_STAFF' || (canUseDeliveries(role) && workspace?.branch.acceptsDelivery) },
  manage: { title: 'Manage', icon: 'store', allowed: canManageMenu },
  account: { title: 'Your account', allowed: () => true, nav: false },
}
// Pages that show the live order sync indicator.
const LIVE_PAGES = ['overview', 'orders', 'kitchen', 'deliveries']

const readPath = () => window.location.pathname.replace(/^\/+|\/+$/g, '') || 'overview'

function readStoredBranch() {
  try { return window.localStorage.getItem(BRANCH_KEY) } catch { return null }
}

function storeBranch(branchId) {
  try { window.localStorage.setItem(BRANCH_KEY, branchId) } catch { /* storage unavailable */ }
}

export default function App() {
  const [path, setPath] = useState(readPath)
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [branchId, setBranchId] = useState(readStoredBranch)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState('')
  const [lastSync, setLastSync] = useState(null)
  const [freshIds, setFreshIds] = useState(() => new Set())
  // null when closed; { branchId: null } to create, { branchId } to edit.
  const [branchDrawer, setBranchDrawer] = useState(null)
  // Set when a notification is clicked so the Orders page opens that order.
  const [focusOrder, setFocusOrder] = useState(null)
  const knownPending = useRef(null)

  const navigate = useCallback((next) => {
    window.history.pushState({}, '', `/${next}`)
    setPath(next)
    setFocusOrder(null)
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    const onPop = () => setPath(readPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // A 401 while signed in means the session was ended elsewhere; drop back to sign-in.
  useEffect(() => {
    if (!user) return undefined
    const onUnauthorized = (event) => {
      toast(event.detail.message, 'error')
      setUser(null)
      setMemberships([])
      navigate('login')
    }
    window.addEventListener('app:unauthorized', onUnauthorized)
    return () => window.removeEventListener('app:unauthorized', onUnauthorized)
  }, [user, navigate])

  const loadMemberships = useCallback(async () => {
    const result = await api('/restaurants/my-memberships')
    setMemberships(result.data)
    return result.data
  }, [])

  // Restore session on load.
  useEffect(() => {
    api('/users/me')
      .then(async (result) => {
        setUser(result.user)
        await loadMemberships()
      })
      .catch((error) => { if (error.status !== 401) toast(error.message, 'error') })
      .finally(() => setBooting(false))
  }, [loadMemberships])

  const workspaces = useMemo(() => buildWorkspaces(memberships), [memberships])
  const workspace = workspaces.find((entry) => entry.branchId === branchId) ?? workspaces[0] ?? null
  const role = workspace?.role

  const loadOrders = useCallback(async (signal) => {
    if (!workspace) return
    try {
      const result = await api(`/branch-orders/${workspace.branchId}`, { signal })
      const pendingIds = result.data.filter((order) => order.orderStatus === 'PENDING').map((order) => order.id)
      // Flag orders that arrived since the previous poll (skip the first load).
      if (knownPending.current) {
        const arrived = pendingIds.filter((id) => !knownPending.current.has(id))
        if (arrived.length > 0) {
          toast(arrived.length === 1 ? 'New order received' : `${arrived.length} new orders received`)
          setFreshIds((current) => new Set([...current, ...arrived]))
        }
      }
      knownPending.current = new Set(pendingIds)
      setOrders(result.data)
      setOrdersError('')
      setLastSync(new Date())
    } catch (error) {
      if (error.name !== 'AbortError') setOrdersError(error.message)
    }
  }, [workspace])

  // Poll the active branch's orders while the tab is visible.
  useEffect(() => {
    if (!workspace) return undefined
    const controller = new AbortController()
    knownPending.current = null
    Promise.resolve()
      .then(() => { setOrdersLoading(true); return loadOrders(controller.signal) })
      .finally(() => { if (!controller.signal.aborted) setOrdersLoading(false) })
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadOrders(controller.signal)
    }, POLL_MS)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [workspace, loadOrders])

  async function updateOrderStatus(order, status, reason) {
    try {
      const result = await api(`/branch-orders/${workspace.branchId}/${order.id}/status`, {
        method: 'PATCH',
        body: { status, ...(reason ? { rejectionReason: reason } : {}) },
      })
      setOrders((current) => current.map((entry) => entry.id === order.id ? result.data : entry))
      setFreshIds((current) => { const next = new Set(current); next.delete(order.id); return next })
      toast(`Order ${order.orderNumber.slice(-8)} updated`)
      return true
    } catch (error) {
      toast(error.message, 'error')
      if (error.status === 409) loadOrders()
      return false
    }
  }

  // Kitchen running behind: push the order back and let the guest know.
  async function delayOrder(order, minutes) {
    try {
      const result = await api(`/branch-orders/${workspace.branchId}/${order.id}/delay`, { method: 'PATCH', body: { minutes } })
      setOrders((current) => current.map((entry) => entry.id === order.id ? result.data : entry))
      toast(`+${minutes} min on ${order.orderNumber.slice(-8)} · customer notified`)
      return true
    } catch (error) {
      toast(error.message, 'error')
      if (error.status === 409) loadOrders()
      return false
    }
  }

  async function setAutoAccept(enabled) {
    try {
      await api(`/restaurants/${workspace.groupId}/branches/${workspace.branchId}`, { method: 'PATCH', body: { autoAcceptPreorders: enabled } })
      await loadMemberships()
      toast(enabled ? 'Pre-orders will be accepted and started automatically' : 'Auto-accept turned off')
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  function selectBranch(id) {
    if (id !== workspace?.branchId) {
      setOrders([])
      setFreshIds(new Set())
    }
    setBranchId(id)
    storeBranch(id)
  }

  async function onAuthenticated(nextUser) {
    setUser(nextUser)
    const data = await loadMemberships()
    const first = buildWorkspaces(data).find((entry) => entry.branchId === branchId) ?? buildWorkspaces(data)[0]
    navigate(first ? homePageFor(first.role) : 'onboarding')
  }

  async function signOut() {
    // Stop pushes to this device for the account that's leaving.
    await disablePush().catch(() => {})
    try { await api('/users/logout', { method: 'POST' }) } catch { /* clear locally regardless */ }
    setUser(null)
    setMemberships([])
    navigate('login')
  }

  async function onRestaurantCreated(newBranchId) {
    await loadMemberships()
    if (newBranchId) selectBranch(newBranchId)
    navigate('overview')
  }

  async function onBranchSaved(savedBranchId) {
    const created = !branchDrawer?.branchId
    setBranchDrawer(null)
    // Refresh names, hours and fulfillment shown across the dashboard.
    await loadMemberships()
    if (created) {
      selectBranch(savedBranchId)
      navigate('manage/branches')
    }
  }

  if (booting) return <div className="boot"><span /></div>

  // Link from the verification email; works signed in or not.
  if (path === 'verify-email') {
    return <><VerifyEmailPage signedIn={Boolean(user)} onVerified={() => setUser((current) => current && { ...current, isEmailVerified: true })} onContinue={() => navigate(user ? homePageFor(role) : 'login')} /><Toasts /></>
  }

  if (path === 'reset-password') {
    return <><ResetPasswordPage onDone={onAuthenticated} onForgot={() => navigate('forgot-password')} /><Toasts /></>
  }

  if (!user && path === 'forgot-password') {
    return <><ForgotPasswordPage onBack={() => navigate('login')} /><Toasts /></>
  }

  if (!user) {
    return <><AuthPage mode={path === 'signup' ? 'signup' : 'login'} onSwitch={navigate} onAuthenticated={onAuthenticated} /><Toasts /></>
  }

  // Invited teammates swap their emailed password before anything else.
  if (user.mustChangePassword) {
    return <><SetPasswordPage user={user} onChanged={(nextUser) => { setUser(nextUser); navigate(homePageFor(role)) }} onSignOut={signOut} /><Toasts /></>
  }

  if (path === 'onboarding' || workspaces.length === 0) {
    return <><OnboardingPage user={user} hasRestaurants={workspaces.length > 0} onCreated={onRestaurantCreated} onCancel={() => navigate('overview')} onSignOut={signOut} /><Toasts /></>
  }

  const [section, tab] = path.split('/')
  const pageKey = PAGES[section]?.allowed(role, workspace) ? section : homePageFor(role)
  const isManage = pageKey === 'manage'
  const home = homePageFor(role)
  const pendingCount = orders.filter((order) => order.orderStatus === 'PENDING').length
  const groups = [...new Map(workspaces.map((entry) => [entry.groupId, entry.groupName])).entries()]
  const canEditBranch = canManageMenu(role)
  const pageProps = { workspace, role, user, workspaces, orders, ordersLoading, ordersError, freshIds, updateOrderStatus, delayOrder, setAutoAccept, reloadOrders: loadOrders, navigate, onSelect: selectBranch, onEditBranch: (id) => setBranchDrawer({ branchId: id }) }
  const readyForDelivery = orders.filter((order) => order.orderStatus === 'READY' && order.fulfillmentType === 'DELIVERY').length
  const toCook = orders.filter((order) => order.orderStatus === 'ACCEPTED').length
  const navPages = Object.entries(PAGES).filter(([, page]) => page.nav !== false && page.allowed(role, workspace))
  const badges = { orders: pendingCount, kitchen: role === 'KITCHEN_STAFF' ? toCook : 0, deliveries: readyForDelivery }

  return (
    <>
      <header className="navbar">
        <div className="navbar-inner">
          {!isManage && <a className="wordmark" href={`/${home}`} onClick={(event) => { event.preventDefault(); navigate(home) }}>CraveQ</a>}

          {/* Becomes a bottom tab bar on phones, unless there's only one page to go to. */}
          <nav className={`nav-links${navPages.length < 2 ? ' single' : ''}`} aria-label="Dashboard">
            {navPages.map(([key, page]) => (
              <a key={key} href={`/${key}`} className={pageKey === key ? 'active' : ''} aria-current={pageKey === key ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate(key) }}>
                <span className="nav-icon"><Icon name={page.icon} size={20} /></span>
                <span className="nav-label">{page.title}</span>
                {badges[key] > 0 && <span className="nav-badge">{badges[key]}</span>}
              </a>
            ))}
          </nav>

          <div className="navbar-right">
            <NotificationBell
              onNotify={(notification) => {
                toast(notification.title)
                // Refresh straight away instead of waiting for the next poll.
                if (notification.branchId === workspace.branchId) loadOrders()
              }}
              onOpen={(notification) => {
                if (notification.branchId && workspaces.some((entry) => entry.branchId === notification.branchId)) selectBranch(notification.branchId)
                const target = workspaces.find((entry) => entry.branchId === notification.branchId)?.role ?? role
                if (canManageMenu(target)) {
                  navigate('orders')
                  setFocusOrder({ id: notification.orderId, nonce: Date.now() })
                } else {
                  navigate(homePageFor(target))
                }
              }}
            />
            <select className="branch-select" value={workspace.branchId} onChange={(event) => selectBranch(event.target.value)} aria-label="Branch">
              {groups.map(([groupId, groupName]) => (
                <optgroup label={groupName} key={groupId}>
                  {workspaces.filter((entry) => entry.groupId === groupId).map((entry) => (
                    <option value={entry.branchId} key={entry.branchId}>{entry.branch.branchName}</option>
                  ))}
                </optgroup>
              ))}
            </select>

            {canEditBranch && (
              <button className="btn btn-ghost" onClick={() => setBranchDrawer({ branchId: workspace.branchId })} title={`Edit ${workspace.branch.branchName}`}>
                <Icon name="edit" size={15} /><span className="hide-sm">Edit branch</span>
              </button>
            )}

            {isManage ? (
              canManageGroup(role) && (
                <button className="btn btn-primary" onClick={() => setBranchDrawer({ branchId: null })} title="Create a new branch">
                  <Icon name="plus" size={16} /><span className="hide-sm">New branch</span>
                </button>
              )
            ) : (
              <div className="user">
                <a className={`user-link${pageKey === 'account' ? ' active' : ''}`} href="/account" title="Your account" onClick={(event) => { event.preventDefault(); navigate('account') }}>
                  <span className="avatar">{initials(user.fullName)}{!user.isEmailVerified && <i className="avatar-dot" aria-label="Email not confirmed" />}</span>
                  <span className="user-copy"><strong>{user.fullName}</strong><small>{ROLE_LABELS[role]}</small></span>
                </a>
                <button className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out"><Icon name="logout" size={17} /></button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container">
        {!user.isEmailVerified && pageKey !== 'account' && <VerifyBanner email={user.email} />}
        <div className="page-head">
          <div>
            <span className="eyebrow">{workspace.groupName} · {workspace.branch.branchName}</span>
            <h1>{PAGES[pageKey].title}</h1>
          </div>
          {LIVE_PAGES.includes(pageKey) && (
            <span className={`sync${ordersError ? ' off' : ''}`}>
              <i />{ordersError ? 'Reconnecting…' : lastSync ? `Updated ${clock(lastSync)}` : 'Connecting…'}
            </span>
          )}
        </div>

        <main className="page" key={`${pageKey}-${workspace.branchId}-${focusOrder?.nonce ?? ''}`}>
          {pageKey === 'overview' && <OverviewPage {...pageProps} />}
          {pageKey === 'orders' && <OrdersPage {...pageProps} initialSelectedId={focusOrder?.id} />}
          {pageKey === 'kitchen' && <KitchenPage {...pageProps} />}
          {pageKey === 'deliveries' && <DeliveriesPage {...pageProps} />}
          {pageKey === 'manage' && <ManagePage {...pageProps} tab={tab} />}
          {pageKey === 'account' && <AccountPage {...pageProps} onUserChange={setUser} onSignOut={signOut} />}
        </main>
      </div>

      {branchDrawer && <BranchDrawer key={branchDrawer.branchId ?? 'new'} groupId={workspace.groupId} groupName={workspace.groupName} branchId={branchDrawer.branchId} onClose={() => setBranchDrawer(null)} onSaved={onBranchSaved} />}
      <Toasts />
    </>
  )
}
