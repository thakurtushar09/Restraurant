import { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import StatusChip from '../components/StatusChip.jsx'
import OrderDrawer from '../components/OrderDrawer.jsx'
import useNow from '../components/useNow.js'
import { ACTIVE_STATUSES, STATUS_META, FULFILLMENT_LABELS, money, timeAgo, clock, isToday, scheduleLabel } from '../lib.js'

function Kpi({ icon, label, value, sub, loading }) {
  return (
    <div className="card kpi">
      <span className="kpi-label"><Icon name={icon} size={15} />{label}</span>
      {loading ? <span className="skeleton" style={{ height: 32, width: '60%' }} /> : <span className="kpi-value">{value}</span>}
      <span className="kpi-sub">{sub}</span>
    </div>
  )
}

// Single-series bar chart: orders placed per hour today.
function HourChart({ orders }) {
  const counts = Array.from({ length: 24 }, () => 0)
  orders.forEach((order) => { counts[new Date(order.createdAt).getHours()] += 1 })
  const max = Math.max(...counts)
  const top = Math.max(2, Math.ceil(max / 2) * 2)
  const currentHour = new Date().getHours()
  const label = (hour) => `${hour % 12 || 12}${hour < 12 ? 'am' : 'pm'}`

  return (
    <div>
      <div className="hour-chart" role="img" aria-label={`Orders per hour today. Busiest: ${max ? `${label(counts.indexOf(max))} with ${max}` : 'no orders yet'}.`}>
        {[top, top / 2].map((value) => (
          <div className="gridline" key={value} style={{ bottom: `${(value / top) * 100}%` }}><span>{value}</span></div>
        ))}
        {counts.map((count, hour) => (
          <div className={`hour-bar${count === 0 ? ' zero' : ''}`} key={hour} style={{ opacity: hour > currentHour ? 0.35 : 1 }}>
            <i style={{ height: `${(count / top) * 100}%` }} />
            <span className="tip">{label(hour)} · {count} {count === 1 ? 'order' : 'orders'}</span>
          </div>
        ))}
      </div>
      <div className="hour-axis">{counts.map((_, hour) => <span key={hour}>{hour % 6 === 0 ? label(hour) : ''}</span>)}</div>
    </div>
  )
}

export default function OverviewPage({ workspace, role, orders, ordersLoading, updateOrderStatus, navigate }) {
  const [selectedId, setSelectedId] = useState(null)
  const now = useNow()
  const currency = workspace.branch.currency ?? 'INR'

  const stats = useMemo(() => {
    const today = orders.filter((order) => isToday(order.createdAt))
    const billable = today.filter((order) => !['REJECTED', 'CANCELLED', 'EXPIRED'].includes(order.orderStatus))
    const revenue = billable.reduce((sum, order) => sum + Number(order.totalAmount), 0)
    const prepTimes = today
      .filter((order) => order.preparingAt && order.readyAt)
      .map((order) => (new Date(order.readyAt) - new Date(order.preparingAt)) / 60000)
    const avgPrep = prepTimes.length ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : null
    const active = orders.filter((order) => ACTIVE_STATUSES.includes(order.orderStatus))
    const byStatus = ACTIVE_STATUSES.map((status) => [status, active.filter((order) => order.orderStatus === status).length])
    const upcoming = orders
      .filter((order) => order.scheduledAt && new Date(order.scheduledAt).getTime() > now && ACTIVE_STATUSES.includes(order.orderStatus))
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    const arrivals = orders.filter((order) => order.fulfillmentType === 'DINE_IN' && order.scheduledAt && isToday(order.scheduledAt) && ACTIVE_STATUSES.includes(order.orderStatus))
    return { today, billable, revenue, avgPrep, active, byStatus, upcoming, arrivals }
  }, [orders, now])

  const pending = stats.active.filter((order) => order.orderStatus === 'PENDING')
  const queue = [...pending, ...stats.upcoming.filter((order) => order.orderStatus !== 'PENDING')].slice(0, 6)
  const selected = orders.find((order) => order.id === selectedId)
  const busiest = Math.max(1, ...stats.byStatus.map(([, n]) => n))

  return (
    <>
      <div className="kpis">
        <Kpi icon="receipt" label="Orders today" value={stats.today.length} sub={`${stats.today.length - stats.billable.length} rejected or cancelled`} loading={ordersLoading && !orders.length} />
        <Kpi icon="wallet" label="Sales today" value={money(stats.revenue, currency)} sub={stats.billable.length > 1 ? `Avg ${money(stats.revenue / stats.billable.length, currency)} per order` : stats.billable.length ? 'From 1 order' : 'No sales yet'} loading={ordersLoading && !orders.length} />
        <Kpi icon="calendar" label="Pre-order arrivals today" value={stats.arrivals.length} sub={stats.arrivals[0] ? `Next at ${clock(stats.arrivals.map((order) => order.scheduledAt).sort()[0])}` : 'None booked yet'} loading={ordersLoading && !orders.length} />
        <Kpi icon="flame" label="In progress" value={stats.active.length} sub={`${pending.length} waiting for you`} loading={ordersLoading && !orders.length} />
        <Kpi icon="clock" label="Avg cook time" value={stats.avgPrep === null ? '—' : `${stats.avgPrep}m`} sub={`Target ${workspace.branch.averagePreparationTimeMinutes ?? 30}m`} loading={ordersLoading && !orders.length} />
      </div>

      <div className="overview-grid">
        <section className="card panel">
          <div className="panel-head"><div><span className="eyebrow">Orders per hour</span><h2>Today’s rhythm</h2></div><span className="chip chip-muted">{stats.today.length} total</span></div>
          <HourChart orders={stats.today} />
        </section>

        <section className="card panel">
          <div className="panel-head"><div><span className="eyebrow">Right now</span><h2>Kitchen load</h2></div></div>
          <div className="status-list">
            {stats.byStatus.map(([status, count]) => (
              <div className="status-row" key={status}>
                <StatusChip status={status} /><span /><b>{count}</b>
                <div className="status-track"><i style={{ width: `${(count / busiest) * 100}%`, background: STATUS_META[status].color }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div><span className="eyebrow">Needs attention</span><h2>Up next</h2></div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('orders')}>Open board <Icon name="arrow" size={14} /></button>
        </div>
        {queue.length === 0 ? (
          <div className="empty" style={{ padding: 28 }}><span className="empty-icon"><Icon name="check" /></span><h3>All caught up</h3><p>New and scheduled orders will appear here.</p></div>
        ) : (
          <div className="queue">
            {queue.map((order) => (
              <button className="queue-row" key={order.id} onClick={() => setSelectedId(order.id)} style={{ border: 0, textAlign: 'left', width: '100%' }}>
                <StatusChip status={order.orderStatus} />
                <div><div className="num">#{order.orderNumber.slice(-8)} · {order.customerName}</div><div className="meta">{order.orderItems.length} {order.orderItems.length === 1 ? 'item' : 'items'} · {FULFILLMENT_LABELS[order.fulfillmentType]}</div></div>
                <div className="right">
                  <div className="num">{money(order.totalAmount, order.currency)}</div>
                  <div className="meta">{order.scheduledAt && new Date(order.scheduledAt).getTime() > now ? `${scheduleLabel(order)} ${clock(order.scheduledAt)}` : `${timeAgo(order.createdAt, now)} ago`}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && <OrderDrawer order={selected} role={role} onUpdate={updateOrderStatus} onClose={() => setSelectedId(null)} />}
    </>
  )
}
