import { useMemo, useState } from 'react'
import useNow from '../components/useNow.js'
import useMediaQuery from '../components/useMediaQuery.js'
import Icon from '../components/Icon.jsx'
import StatusChip from '../components/StatusChip.jsx'
import OrderActions from '../components/OrderActions.jsx'
import AutoAcceptSwitch from '../components/AutoAcceptSwitch.jsx'
import OrderDrawer from '../components/OrderDrawer.jsx'
import { ACTIVE_STATUSES, CLOSED_STATUSES, STATUS_META, money, timeAgo, clock, shortDate, scheduleLabel, cookByTime, fulfillmentLabel } from '../lib.js'

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

function OrderCard({ order, role, now, prepMinutes, fresh, onOpen, onUpdate, featured = false }) {
  const scheduled = order.scheduledAt && new Date(order.scheduledAt).getTime() > now
  const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
  return (
    <article className={`order-card${fresh ? ' is-new' : ''}${featured ? ' is-current' : ''}`} onClick={onOpen} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpen() }}>
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
        {order.orderItems.slice(0, featured ? undefined : 3).map((item) => <span key={item.id}><b>{item.quantity}×</b> {item.itemName}{item.variantName ? ` · ${item.variantName}` : ''}</span>)}
        {!featured && order.orderItems.length > 3 && <span>+{order.orderItems.length - 3} more</span>}
      </div>
      <div className="order-card-foot">
        <span className={`chip ${order.tableNumber ? 'chip-forest' : 'chip-muted'}`}>{order.tableNumber && <Icon name="qr" size={11} />}{fulfillmentLabel(order)}</span>
        {order.partySize && <span className="chip chip-muted"><Icon name="users" size={11} /> {order.partySize}</span>}
        {order.delayMinutes > 0 && <span className="late-chip">+{order.delayMinutes}m</span>}
        {order.customerNotes && <span className="chip chip-accent" title={order.customerNotes}>Note</span>}
        <span className="total" title={`${itemCount} items`}>{money(order.totalAmount, order.currency)}</span>
      </div>
      {featured && order.customerNotes && <p className="order-note"><b>Note:</b> {order.customerNotes}</p>}
      <OrderActions order={order} role={role} onUpdate={onUpdate} size={featured ? 'md' : 'sm'} />
    </article>
  )
}

// Compact row for orders waiting behind the current one.
function QueueRow({ order, position, now, prepMinutes, fresh, onOpen }) {
  const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
  const scheduled = order.scheduledAt && new Date(order.scheduledAt).getTime() > now
  return (
    <li>
      <button type="button" className={`queue-item${fresh ? ' is-new' : ''}`} onClick={onOpen}>
        <span className="pos">{position}</span>
        <span className="queue-main">
          <strong>#{order.orderNumber.slice(-8)} · {order.customerName}</strong>
          <small>{itemCount} {itemCount === 1 ? 'item' : 'items'} · {fulfillmentLabel(order)} · {money(order.totalAmount, order.currency)}</small>
        </span>
        {scheduled
          ? <span className="age"><Icon name="calendar" size={12} /> {clock(order.scheduledAt)}</span>
          : <span className={`age${isLate(order, now, prepMinutes) ? ' late' : ''}`}>{timeAgo(order.createdAt, now)}</span>}
      </button>
    </li>
  )
}

const UP_NEXT_LIMIT = 6

// One status as a queue: the oldest order up front with its actions; once it moves on, the next takes its place.
function StatusSection({ status, list, loading, expanded, onToggle, cardProps }) {
  const [current, ...rest] = list
  const meta = STATUS_META[status]
  return (
    <section className={`status-section${list.length === 0 && !loading ? ' is-empty' : ''}`} aria-label={meta.label} style={{ '--status': meta.color }}>
      <header className="status-head">
        <span className="dot" />
        <h2>{meta.label}</h2>
        <span className="n">{list.length}</span>
        {list.length > 1 && <button type="button" className="text-btn" onClick={onToggle} aria-expanded={expanded}>{expanded ? 'Show as queue' : `Show all ${list.length}`}</button>}
      </header>
      {loading ? (
        <div className="order-queue"><div className="skeleton" style={{ height: 180 }} /><div className="skeleton" style={{ height: 120 }} /></div>
      ) : list.length === 0 ? null : expanded ? (
        <div className="status-grid">
          {list.map((order) => <OrderCard key={order.id} order={order} {...cardProps(order)} />)}
        </div>
      ) : (
        <div className={`order-queue${rest.length ? '' : ' single'}`}>
          <OrderCard key={current.id} order={current} featured {...cardProps(current)} />
          {rest.length > 0 && (
            <div className="up-next">
              <span className="up-next-title">Up next · {rest.length}</span>
              <ol>
                {rest.slice(0, UP_NEXT_LIMIT).map((order, index) => {
                  const { now, prepMinutes, fresh, onOpen } = cardProps(order)
                  return <QueueRow key={order.id} order={order} position={index + 2} now={now} prepMinutes={prepMinutes} fresh={fresh} onOpen={onOpen} />
                })}
              </ol>
              {rest.length > UP_NEXT_LIMIT && <button type="button" className="text-btn" onClick={onToggle}>+{rest.length - UP_NEXT_LIMIT} more — show all</button>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function OrdersPage({ workspace, role, orders, ordersLoading, ordersError, freshIds, updateOrderStatus, delayOrder, setAutoAccept, reloadOrders, initialSelectedId = null }) {
  const [view, setView] = useState('board')
  const [query, setQuery] = useState('')
  const [fulfillment, setFulfillment] = useState('')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [expanded, setExpanded] = useState({})
  // Phones and small tablets get stacked status queues; wider screens keep the side-by-side board.
  const smallScreen = useMediaQuery('(max-width: 860px)')
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
      <AutoAcceptSwitch workspace={workspace} role={role} onChange={setAutoAccept} />
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
      ) : view === 'board' && !smallScreen ? (
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
      ) : view === 'board' ? (
        <div className="orders-stack">
          {columns.map((status) => (
            <StatusSection
              key={status}
              status={status}
              list={active.filter((order) => order.orderStatus === status).sort((a, b) => sortKey(a) - sortKey(b))}
              loading={ordersLoading && orders.length === 0}
              expanded={Boolean(expanded[status])}
              onToggle={() => setExpanded((current) => ({ ...current, [status]: !current[status] }))}
              cardProps={(order) => ({ role, now, prepMinutes, fresh: freshIds.has(order.id), onOpen: () => setSelectedId(order.id), onUpdate: updateOrderStatus })}
            />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="card empty"><span className="empty-icon"><Icon name="receipt" /></span><h3>No finished orders yet</h3><p>Completed, cancelled and rejected orders will show up here.</p></div>
      ) : (
        <div className="card history table-wrap">
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th className="hide-sm">Type</th><th>Status</th><th className="hide-sm">Placed</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {history.map((order) => (
                <tr key={order.id} onClick={() => setSelectedId(order.id)} style={{ cursor: 'pointer' }}>
                  <td className="num"><b>#{order.orderNumber.slice(-8)}</b></td>
                  <td>{order.customerName}</td>
                  <td className="hide-sm">{fulfillmentLabel(order)}</td>
                  <td><StatusChip status={order.orderStatus} /></td>
                  <td className="num hide-sm">{shortDate(order.createdAt)}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{money(order.totalAmount, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <OrderDrawer order={selected} role={role} onUpdate={updateOrderStatus} onDelay={delayOrder} onClose={() => setSelectedId(null)} />}
    </>
  )
}
