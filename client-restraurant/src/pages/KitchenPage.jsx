import { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import OrderDrawer from '../components/OrderDrawer.jsx'
import useNow from '../components/useNow.js'
import { clock, cookByTime, minutesFrom, duration, nextActions, fulfillmentLabel } from '../lib.js'

// Ticket timing in kitchen terms: when to fire, how long it's been cooking, how long it's waited.
function ticketTiming(order, now, prepMinutes) {
  if (order.orderStatus === 'ACCEPTED') {
    const fireAt = order.scheduledAt ? cookByTime(order, prepMinutes) : new Date(order.acceptedAt ?? order.createdAt)
    const minutes = minutesFrom(fireAt, now)
    if (minutes > 0) return { tone: 'calm', label: `Start in ${duration(minutes)}`, sub: `at ${clock(fireAt)}` }
    return { tone: minutes < -5 ? 'late' : 'now', label: minutes < -1 ? `Start now · ${duration(minutes)} late` : 'Start now', sub: order.scheduledAt ? `Guest ${order.fulfillmentType === 'DINE_IN' ? 'arrives' : 'expects it'} ${clock(order.scheduledAt)}` : 'As soon as possible' }
  }
  if (order.orderStatus === 'PREPARING') {
    const cooking = -minutesFrom(order.preparingAt ?? order.updatedAt, now)
    const progress = Math.min(1, cooking / Math.max(prepMinutes, 1))
    return { tone: cooking > prepMinutes ? 'late' : 'calm', label: `Cooking ${duration(cooking)}`, sub: `Target ${prepMinutes}m`, progress }
  }
  const waiting = -minutesFrom(order.readyAt ?? order.updatedAt, now)
  return { tone: waiting > 10 ? 'late' : 'calm', label: `Ready ${duration(waiting)} ago`, sub: order.fulfillmentType === 'DELIVERY' ? 'Waiting for a rider' : 'Waiting to be served' }
}

function Ticket({ order, role, now, prepMinutes, onUpdate, onOpen }) {
  const [busy, setBusy] = useState(false)
  const timing = ticketTiming(order, now, prepMinutes)
  // The kitchen screen only offers forward steps; cancelling lives in the order drawer.
  const action = nextActions(order, role).find((entry) => entry.tone === 'primary' && ['PREPARING', 'READY'].includes(entry.status))

  async function run(event) {
    event.stopPropagation()
    setBusy(true)
    await onUpdate(order, action.status)
    setBusy(false)
  }

  return (
    <article className={`ticket tone-${timing.tone}`} onClick={onOpen} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpen() }}>
      <header className="ticket-head">
        <div>
          <span className="ticket-num">#{order.orderNumber.slice(-6)}</span>
          <span className="ticket-who">{order.customerName}</span>
        </div>
        <div className="ticket-tags">
          <span className={`chip ${order.tableNumber ? 'chip-forest' : 'chip-muted'}`}>{fulfillmentLabel(order)}</span>
          {order.partySize && <span className="chip chip-muted"><Icon name="users" size={11} /> {order.partySize}</span>}
        </div>
      </header>

      <div className="ticket-time">
        <Icon name={order.orderStatus === 'READY' ? 'check' : order.orderStatus === 'PREPARING' ? 'flame' : 'clock'} size={15} />
        <strong>{timing.label}</strong><span>{timing.sub}</span>
      </div>
      {timing.progress !== undefined && <div className="ticket-progress"><i style={{ width: `${timing.progress * 100}%` }} /></div>}

      <ul className="ticket-items">
        {order.orderItems.map((item) => (
          <li key={item.id}>
            <b>{item.quantity}</b>
            <span>{item.itemName}{item.variantName && <small>{item.variantName}</small>}</span>
          </li>
        ))}
      </ul>

      {order.customerNotes && <p className="ticket-note"><Icon name="alert" size={14} /> {order.customerNotes}</p>}

      {action && (
        <button className="btn btn-primary btn-block ticket-action" disabled={busy} onClick={run}>
          {busy ? 'Saving…' : action.status === 'PREPARING' ? <><Icon name="flame" size={16} /> Start cooking</> : <><Icon name="check" size={16} /> Mark ready</>}
        </button>
      )}
    </article>
  )
}

const LANES = [
  { status: 'ACCEPTED', title: 'Up next', empty: 'No tickets waiting. Accepted orders land here.' },
  { status: 'PREPARING', title: 'Cooking', empty: 'Nothing on the stove.' },
  { status: 'READY', title: 'Ready', empty: 'Finished dishes wait here until they’re served or picked up.' },
]

export default function KitchenPage({ workspace, role, orders, ordersLoading, ordersError, updateOrderStatus, reloadOrders }) {
  const [selectedId, setSelectedId] = useState(null)
  const now = useNow()
  const prepMinutes = workspace.branch.averagePreparationTimeMinutes ?? 30

  const { lanes, tally, doneCount } = useMemo(() => {
    // Next to fire first: scheduled tickets by their cook-by time, the rest by when they came in.
    const fireTime = (order) => (order.scheduledAt ? cookByTime(order, prepMinutes) : new Date(order.acceptedAt ?? order.createdAt)).getTime()
    const byLane = Object.fromEntries(LANES.map(({ status }) => [status, orders.filter((order) => order.orderStatus === status)]))
    byLane.ACCEPTED.sort((a, b) => fireTime(a) - fireTime(b))
    byLane.PREPARING.sort((a, b) => new Date(a.preparingAt) - new Date(b.preparingAt))
    byLane.READY.sort((a, b) => new Date(a.readyAt) - new Date(b.readyAt))

    // "All day" counts: how many of each dish are still to be made.
    const counts = new Map()
    for (const order of [...byLane.ACCEPTED, ...byLane.PREPARING]) {
      for (const item of order.orderItems) {
        const name = item.variantName ? `${item.itemName} · ${item.variantName}` : item.itemName
        counts.set(name, (counts.get(name) ?? 0) + item.quantity)
      }
    }

    const done = orders.filter((order) => order.readyAt && ['READY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(order.orderStatus) && now - new Date(order.readyAt).getTime() < 12 * 3600000).length
    return { lanes: byLane, tally: [...counts.entries()].sort((a, b) => b[1] - a[1]), doneCount: done }
  }, [orders, now, prepMinutes])

  const selected = orders.find((order) => order.id === selectedId)
  const lateCount = lanes.ACCEPTED.filter((order) => ticketTiming(order, now, prepMinutes).tone !== 'calm').length

  if (ordersError && orders.length === 0) {
    return <div className="card empty"><span className="empty-icon"><Icon name="alert" /></span><h3>Couldn’t load the kitchen</h3><p>{ordersError}</p><button className="btn btn-primary" onClick={() => reloadOrders()}>Try again</button></div>
  }

  return (
    <>
      <div className="kitchen-strip">
        <div className={`strip-stat${lateCount ? ' alert' : ''}`}><span>To start now</span><strong>{lateCount}</strong></div>
        <div className="strip-stat"><span>Waiting</span><strong>{lanes.ACCEPTED.length}</strong></div>
        <div className="strip-stat"><span>Cooking</span><strong>{lanes.PREPARING.length}</strong></div>
        <div className="strip-stat"><span>Ready</span><strong>{lanes.READY.length}</strong></div>
        <div className="strip-stat"><span>Done this shift</span><strong>{doneCount}</strong></div>
      </div>

      <div className="kitchen-layout">
        <div className="lanes">
          {LANES.map((lane) => (
            <section className="lane" key={lane.status} aria-label={lane.title}>
              <div className="lane-head"><h2>{lane.title}</h2><span className="n">{lanes[lane.status].length}</span></div>
              {ordersLoading && orders.length === 0
                ? [0, 1].map((key) => <div className="skeleton" key={key} style={{ height: 180 }} />)
                : lanes[lane.status].length === 0
                  ? <div className="column-empty">{lane.empty}</div>
                  : lanes[lane.status].map((order) => <Ticket key={order.id} order={order} role={role} now={now} prepMinutes={prepMinutes} onUpdate={updateOrderStatus} onOpen={() => setSelectedId(order.id)} />)}
            </section>
          ))}
        </div>

        <aside className="card panel tally">
          <div className="panel-head"><div><span className="eyebrow">Still to make</span><h2>All-day count</h2></div></div>
          {tally.length === 0 ? <p className="tally-empty">Nothing to prep right now.</p> : (
            <ul>
              {tally.map(([name, count]) => <li key={name}><span>{name}</span><b>{count}</b></li>)}
            </ul>
          )}
        </aside>
      </div>

      {selected && <OrderDrawer order={selected} role={role} onUpdate={updateOrderStatus} onClose={() => setSelectedId(null)} />}
    </>
  )
}
