import { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import OrderDrawer from '../components/OrderDrawer.jsx'
import useNow from '../components/useNow.js'
import { money, clock, mapsUrl, minutesFrom, duration, nextActions } from '../lib.js'

function needsCash(order) {
  return order.paymentMethod && order.paymentMethod !== 'ONLINE' && order.paymentStatus !== 'PAID'
}

function DeliveryCard({ order, role, now, onUpdate, onOpen }) {
  const [busy, setBusy] = useState(false)
  const action = nextActions(order, role).find((entry) => ['OUT_FOR_DELIVERY', 'COMPLETED'].includes(entry.status))
  const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
  const since = order.orderStatus === 'READY' ? order.readyAt : order.outForDeliveryAt
  const waited = since ? -minutesFrom(since, now) : null
  const due = order.scheduledAt ? minutesFrom(order.scheduledAt, now) : null

  async function run() {
    setBusy(true)
    await onUpdate(order, action.status)
    setBusy(false)
  }

  return (
    <article className="delivery-card card">
      <header className="delivery-head">
        <button className="text-btn" onClick={onOpen}><span className="ticket-num">#{order.orderNumber.slice(-6)}</span></button>
        {due !== null
          ? <span className={`chip ${due < 0 ? 'chip-danger' : 'chip-accent'}`}><Icon name="clock" size={11} /> {due < 0 ? `Due ${duration(due)} ago` : `Due ${clock(order.scheduledAt)}`}</span>
          : waited !== null && <span className={`chip ${waited > 15 ? 'chip-danger' : 'chip-muted'}`}>{order.orderStatus === 'READY' ? `Ready ${duration(waited)}` : `Out ${duration(waited)}`}</span>}
      </header>

      <div className="delivery-who">
        <strong>{order.customerName}</strong>
        <a className="btn btn-ghost btn-sm" href={`tel:${order.customerPhone}`}><Icon name="phone" size={14} /> {order.customerPhone}</a>
      </div>

      <address className="delivery-address">
        <Icon name="pin" size={16} />
        <span>
          {order.deliveryAddressLine1}{order.deliveryAddressLine2 && `, ${order.deliveryAddressLine2}`}
          <small>{[order.deliveryLandmark && `Near ${order.deliveryLandmark}`, order.deliveryCity, order.deliveryPostalCode].filter(Boolean).join(' · ')}</small>
        </span>
      </address>

      {order.customerNotes && <p className="ticket-note"><Icon name="alert" size={14} /> {order.customerNotes}</p>}

      <div className="delivery-foot">
        <span className="delivery-pay">
          {itemCount} {itemCount === 1 ? 'item' : 'items'} · {needsCash(order)
            ? <b className="collect">Collect {money(order.totalAmount, order.currency)} cash</b>
            : <b>Paid {money(order.totalAmount, order.currency)}</b>}
        </span>
        <a className="btn btn-ghost btn-sm" href={mapsUrl(order)} target="_blank" rel="noreferrer"><Icon name="navigate" size={14} /> Directions</a>
      </div>

      {action && (
        <button className="btn btn-primary btn-block" style={{ minHeight: 46 }} disabled={busy} onClick={run}>
          {busy ? 'Saving…' : action.status === 'OUT_FOR_DELIVERY' ? <><Icon name="bike" size={16} /> Picked up — start delivery</> : <><Icon name="check" size={16} /> Mark delivered</>}
        </button>
      )}
    </article>
  )
}

export default function DeliveriesPage({ role, orders, ordersLoading, ordersError, updateOrderStatus, reloadOrders }) {
  const [selectedId, setSelectedId] = useState(null)
  const now = useNow()

  const groups = useMemo(() => {
    const deliveries = orders.filter((order) => order.fulfillmentType === 'DELIVERY')
    const byTime = (key) => (a, b) => new Date(a[key] ?? a.createdAt) - new Date(b[key] ?? b.createdAt)
    return {
      ready: deliveries.filter((order) => order.orderStatus === 'READY').sort(byTime('readyAt')),
      onTheWay: deliveries.filter((order) => order.orderStatus === 'OUT_FOR_DELIVERY').sort(byTime('outForDeliveryAt')),
      // Kitchen hasn't finished these yet; shown so riders can plan the next run.
      coming: deliveries.filter((order) => ['ACCEPTED', 'PREPARING'].includes(order.orderStatus)),
      done: deliveries
        .filter((order) => order.orderStatus === 'COMPLETED' && order.completedAt && now - new Date(order.completedAt).getTime() < 12 * 3600000)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)),
    }
  }, [orders, now])

  const cashToCollect = groups.onTheWay.concat(groups.ready).filter(needsCash).reduce((sum, order) => sum + Number(order.totalAmount), 0)
  const currency = orders[0]?.currency ?? 'INR'
  const selected = orders.find((order) => order.id === selectedId)

  if (ordersError && orders.length === 0) {
    return <div className="card empty"><span className="empty-icon"><Icon name="alert" /></span><h3>Couldn’t load deliveries</h3><p>{ordersError}</p><button className="btn btn-primary" onClick={() => reloadOrders()}>Try again</button></div>
  }

  const section = (title, list, empty) => (
    <section className="delivery-section">
      <div className="lane-head"><h2>{title}</h2><span className="n">{list.length}</span></div>
      {ordersLoading && orders.length === 0
        ? <div className="skeleton" style={{ height: 200 }} />
        : list.length === 0
          ? <div className="column-empty">{empty}</div>
          : <div className="delivery-grid">{list.map((order) => <DeliveryCard key={order.id} order={order} role={role} now={now} onUpdate={updateOrderStatus} onOpen={() => setSelectedId(order.id)} />)}</div>}
    </section>
  )

  return (
    <>
      <div className="kitchen-strip">
        <div className={`strip-stat${groups.ready.length ? ' alert' : ''}`}><span>Ready to pick up</span><strong>{groups.ready.length}</strong></div>
        <div className="strip-stat"><span>On the way</span><strong>{groups.onTheWay.length}</strong></div>
        {groups.coming.length > 0 && <div className="strip-stat"><span>Still cooking</span><strong>{groups.coming.length}</strong></div>}
        <div className="strip-stat"><span>Cash to collect</span><strong>{money(cashToCollect, currency)}</strong></div>
        <div className="strip-stat"><span>Delivered this shift</span><strong>{groups.done.length}</strong></div>
      </div>

      {section('Ready to pick up', groups.ready, 'Nothing to pick up. You’ll get a notification when food is packed.')}
      {section('On the way', groups.onTheWay, 'No deliveries in progress.')}

      {groups.done.length > 0 && (
        <section className="delivery-section">
          <div className="lane-head"><h2>Delivered this shift</h2><span className="n">{groups.done.length}</span></div>
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Area</th><th>Delivered</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {groups.done.map((order) => (
                  <tr key={order.id} onClick={() => setSelectedId(order.id)} style={{ cursor: 'pointer' }}>
                    <td className="num"><b>#{order.orderNumber.slice(-6)}</b></td>
                    <td>{order.customerName}</td>
                    <td>{order.deliveryCity ?? '—'}</td>
                    <td className="num">{clock(order.completedAt)}</td>
                    <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{money(order.totalAmount, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected && <OrderDrawer order={selected} role={role} onUpdate={updateOrderStatus} onClose={() => setSelectedId(null)} />}
    </>
  )
}
