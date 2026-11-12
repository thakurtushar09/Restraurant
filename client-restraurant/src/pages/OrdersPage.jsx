import { useMemo, useState } from 'react'
import useNow from '../components/useNow.js'
import Icon from '../components/Icon.jsx'
import StatusChip from '../components/StatusChip.jsx'
import OrderActions from '../components/OrderActions.jsx'
import OrderDrawer from '../components/OrderDrawer.jsx'
import { ACTIVE_STATUSES, CLOSED_STATUSES, STATUS_META, FULFILLMENT_LABELS, money, timeAgo, clock, shortDate, scheduleLabel, cookByTime } from '../lib.js'

const ROLE_COLUMNS = {
  KITCHEN_STAFF: ['ACCEPTED', 'PREPARING', 'READY'],
  DELIVERY_STAFF: ['READY', 'OUT_FOR_DELIVERY'],
}

function isLate(order, now, prepMinutes) {
  // Scheduled orders are late once their time passes and the food isn't ready yet.
  if (order.scheduledAt) return now > new Date(order.scheduledAt).getTime() && ['PENDING', 'ACCEPTED', 'PREPARING'].includes(order.orderStatus)
  const minutes = (now - new Date(order.createdAt).getTime()) / 60000
  return order.orderStatus === 'PENDING' ? minutes > 5 : minutes > prepMinutes + 10
}

function OrderCard({ order, role, now, prepMinutes, fresh, onOpen, onUpdate }) {
  const scheduled = order.scheduledAt && new Date(order.scheduledAt).getTime() > now
  const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
  return (
    <article className={`order-card${fresh ? ' is-new' : ''}`} onClick={onOpen} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpen() }}>
      <div className="order-card-top">
        <span className="num">#{order.orderNumber.slice(-8)}</span>
        {fresh && <span className="chip chip-accent">New</span>}
        {scheduled
          ? <span className="age"><Icon name="calendar" size={12} /> {scheduleLabel(order)} {clock(order.scheduledAt)}</span>
          : <span className={`age${isLate(order, now, prepMinutes) ? ' late' : ''}`}>{timeAgo(order.createdAt, now)}</span>}
      </div>
      <span className="order-customer">{order.customerName}</span>
      {scheduled && ['PENDING', 'ACCEPTED'].includes(order.orderStatus) && (
        <span className="cook-by"><Icon name="flame" size={13} /> Start cooking by {clock(cookByTime(order, prepMinutes))}</span>
      )}
      <div className="order-lines">
        {order.orderItems.slice(0, 3).map((item) => <span key={item.id}><b>{item.quantity}×</b> {item.itemName}{item.variantName ? ` · ${item.variantName}` : ''}</span>)}
        {order.orderItems.length > 3 && <span>+{order.orderItems.length - 3} more</span>}
      </div>
      <div className="order-card-foot">
        <span className="chip chip-muted">{FULFILLMENT_LABELS[order.fulfillmentType]}</span>
        {order.partySize && <span className="chip chip-muted"><Icon name="users" size={11} /> {order.partySize}</span>}
        {order.customerNotes && <span className="chip chip-accent" title={order.customerNotes}>Note</span>}
        <span className="total" title={`${itemCount} items`}>{money(order.totalAmount, order.currency)}</span>
      </div>
      <OrderActions order={order} role={role} onUpdate={onUpdate} />
    </article>
  )
}

export default function OrdersPage({ workspace, role, orders, ordersLoading, ordersError, freshIds, updateOrderStatus, reloadOrders, initialSelectedId = null }) {
  const [view, setView] = useState('board')
  const [query, setQuery] = useState('')
  const [fulfillment, setFulfillment] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const now = useNow()
  const prepMinutes = workspace.branch.averagePreparationTimeMinutes ?? 30

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((order) =>
      (!fulfillment || order.fulfillmentType === fulfillment) &&
      (!q || `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.orderItems.map((item) => item.itemName).join(' ')}`.toLowerCase().includes(q)))
  }, [orders, query, fulfillment])

  const columns = ROLE_COLUMNS[role] ?? ACTIVE_STATUSES
  const active = filtered.filter((order) => ACTIVE_STATUSES.includes(order.orderStatus))
  const history = filtered.filter((order) => CLOSED_STATUSES.includes(order.orderStatus))
  const selected = orders.find((order) => order.id === selectedId)

  // Oldest first so the next ticket to cook is on top; scheduled orders sort by their slot.
  const sortKey = (order) => new Date(order.scheduledAt ?? order.createdAt).getTime()

  return (
    <>
      <div className="toolbar">
        <div className="segmented" role="tablist">
          <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>Board<span className="count">{active.length}</span></button>
          <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>History<span className="count">{history.length}</span></button>
        </div>
        <label className="search"><Icon name="search" size={16} /><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders, customers, dishes" aria-label="Search orders" /></label>
        <div className="segmented">
          {[['', 'All'], ['DINE_IN', 'Pre-orders'], ['DELIVERY', 'Delivery']].map(([value, label]) => (
            <button key={label} className={fulfillment === value ? 'active' : ''} onClick={() => setFulfillment(value)}>{label}</button>
          ))}
        </div>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={() => reloadOrders()}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      {ordersError && orders.length === 0 ? (
        <div className="card empty"><span className="empty-icon"><Icon name="alert" /></span><h3>Couldn’t load orders</h3><p>{ordersError}</p><button className="btn btn-primary" onClick={() => reloadOrders()}>Try again</button></div>
      ) : view === 'board' ? (
        <div className="board">
          {columns.map((status) => {
            const list = active.filter((order) => order.orderStatus === status).sort((a, b) => sortKey(a) - sortKey(b))
            return (
              <section className="column" key={status} aria-label={STATUS_META[status].label}>
                <div className="column-head"><span className="dot" style={{ background: STATUS_META[status].color }} />{STATUS_META[status].label}<span className="n">{list.length}</span></div>
                {ordersLoading && orders.length === 0
                  ? [0, 1].map((key) => <div className="skeleton" key={key} style={{ height: 150 }} />)
                  : list.length === 0
                    ? <div className="column-empty">Nothing here</div>
                    : list.map((order) => <OrderCard key={order.id} order={order} role={role} now={now} prepMinutes={prepMinutes} fresh={freshIds.has(order.id)} onOpen={() => setSelectedId(order.id)} onUpdate={updateOrderStatus} />)}
              </section>
            )
          })}
        </div>
      ) : history.length === 0 ? (
        <div className="card empty"><span className="empty-icon"><Icon name="receipt" /></span><h3>No finished orders yet</h3><p>Completed, cancelled and rejected orders will show up here.</p></div>
      ) : (
        <div className="card history table-wrap">
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Status</th><th>Placed</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {history.map((order) => (
                <tr key={order.id} onClick={() => setSelectedId(order.id)} style={{ cursor: 'pointer' }}>
                  <td className="num"><b>#{order.orderNumber.slice(-8)}</b></td>
                  <td>{order.customerName}</td>
                  <td>{FULFILLMENT_LABELS[order.fulfillmentType]}</td>
                  <td><StatusChip status={order.orderStatus} /></td>
                  <td className="num">{shortDate(order.createdAt)}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{money(order.totalAmount, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <OrderDrawer order={selected} role={role} onUpdate={updateOrderStatus} onClose={() => setSelectedId(null)} />}
    </>
  )
}
