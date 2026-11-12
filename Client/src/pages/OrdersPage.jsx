import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import PageHero from '../components/PageHero.jsx'
import useReveal from '../components/useReveal.js'
import { api, money, statusLabel, formatInZone, ACTIVE_STATUSES, FULFILLMENT_LABELS } from '../lib.js'

export default function OrdersPage({ navigate, onSignOut }) {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const rootRef = useRef(null)
  useReveal(rootRef, orders?.length ?? 0)

  useEffect(() => {
    const controller = new AbortController()
    const load = () => api('/customer-orders/me', { signal: controller.signal })
      .then((result) => setOrders(result.data))
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message) })
    load()
    // Statuses update live when a notification arrives.
    window.addEventListener('order-update', load)
    return () => { controller.abort(); window.removeEventListener('order-update', load) }
  }, [])

  const upcoming = orders?.filter((order) => ACTIVE_STATUSES.includes(order.orderStatus)) ?? []
  const past = orders?.filter((order) => !ACTIVE_STATUSES.includes(order.orderStatus)) ?? []

  const row = (order, index) => (
    <button className="order-row" data-reveal style={{ '--d': `${Math.min(index, 6) * 60}ms` }} key={order.id} onClick={() => navigate('order', order.id)}>
      <span className={`status-dot s-${order.orderStatus.toLowerCase()}`} aria-hidden="true" />
      <span className="main">
        <strong>{order.branch.restaurantGroup.groupName} · {order.branch.branchName}</strong>
        <small>
          {FULFILLMENT_LABELS[order.fulfillmentType] ?? order.fulfillmentType}
          {order.partySize ? ` · Table for ${order.partySize}` : ''}
          {order.scheduledAt ? ` · ${order.fulfillmentType === 'DINE_IN' ? 'Arriving' : 'For'} ${formatInZone(order.scheduledAt)}` : ` · ${formatInZone(order.createdAt)}`}
        </small>
        <small>{order.orderItems.map((item) => `${item.quantity}× ${item.itemName}`).join(', ')}</small>
      </span>
      <span className="side">
        <span className="chip">{statusLabel(order)}</span>
        <strong>{money(order.totalAmount)}</strong>
      </span>
    </button>
  )

  return (
    <main ref={rootRef}>
      <PageHero
        compact
        eyebrow={upcoming.length ? <><span className="live" />{upcoming.length} upcoming</> : 'Your table, your time'}
        title={<>My <em>orders.</em></>}
        lede="Track pre-orders, change your arrival time, or look back at past meals."
      >
        <button className="btn btn-ghost btn-sm mobile-only" onClick={onSignOut}>Sign out</button>
      </PageHero>
      <div className="wrap" style={{ padding: '36px 0 80px' }}>
      {error ? (
        <div className="state" style={{ background: 'var(--white)' }}><span className="state-icon"><Icon name="alert" /></span><h2>Couldn’t load your orders</h2><p>{error}</p></div>
      ) : orders === null ? (
        <div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2].map((key) => <div className="skeleton" key={key} style={{ height: 92 }} />)}</div>
      ) : orders.length === 0 ? (
        <div className="state" style={{ background: 'var(--white)' }}><span className="state-icon"><Icon name="calendar" /></span><h2>No orders yet</h2><p>Pre-order your next meal and walk in to a ready table.</p><button className="btn btn-primary" onClick={() => navigate('explore')}>Find a kitchen</button></div>
      ) : <>
        {upcoming.length > 0 && <section className="order-group card-group"><h2>Upcoming</h2><div className="order-list">{upcoming.map(row)}</div></section>}
        {past.length > 0 && <section className="order-group"><h2>Past orders</h2><div className="order-list">{past.map(row)}</div></section>}
      </>}
      </div>
    </main>
  )
}
