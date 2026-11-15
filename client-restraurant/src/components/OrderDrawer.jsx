import { useState } from 'react'
import Icon from './Icon.jsx'
import StatusChip from './StatusChip.jsx'
import OrderActions from './OrderActions.jsx'
import { Drawer } from './Overlay.jsx'
import { money, clock, shortDate, scheduleLabel, fulfillmentLabel, canUseKitchen } from '../lib.js'

const STEPS = [
  ['Placed', 'createdAt'],
  ['Accepted', 'acceptedAt'],
  ['Cooking', 'preparingAt'],
  ['Ready', 'readyAt'],
  ['Out for delivery', 'outForDeliveryAt'],
  ['Completed', 'completedAt'],
]

const DELAY_STEPS = [5, 10, 15, 30]

// "Running late?" — push the ready time back; the customer is notified by the server.
function ExtendTime({ order, onDelay }) {
  const [busy, setBusy] = useState(null)

  async function add(minutes) {
    setBusy(minutes)
    await onDelay(order, minutes)
    setBusy(null)
  }

  return (
    <div className="detail-block extend-time">
      <span className="label">Running late?</span>
      {order.delayMinutes > 0
        ? <span>Pushed back {order.delayMinutes} min · customer expects it around <strong>{clock(order.delayedUntil)}</strong></span>
        : <span className="muted">Add time and we’ll tell the customer the new ready time.</span>}
      <div className="extend-buttons">
        {DELAY_STEPS.map((minutes) => (
          <button key={minutes} type="button" className="btn btn-ghost btn-sm" disabled={busy !== null || order.delayMinutes + minutes > 180} onClick={() => add(minutes)}>
            {busy === minutes ? '…' : `+${minutes} min`}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function OrderDrawer({ order, role, onUpdate, onDelay, onClose }) {
  const steps = STEPS.filter(([, key]) => key !== 'outForDeliveryAt' || order.fulfillmentType === 'DELIVERY')
  const address = [order.deliveryAddressLine1, order.deliveryAddressLine2, order.deliveryLandmark, order.deliveryCity, order.deliveryPostalCode].filter(Boolean).join(', ')

  return (
    <Drawer
      eyebrow={`${fulfillmentLabel(order)} · ${shortDate(order.createdAt)}`}
      title={`Order ${order.orderNumber.slice(-8)}`}
      onClose={onClose}
      footer={<OrderActions order={order} role={role} onUpdate={onUpdate} size="md" />}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <StatusChip status={order.orderStatus} />
        <span className="chip chip-muted">{order.paymentStatus.replaceAll('_', ' ').toLowerCase()}{order.paymentMethod ? ` · ${order.paymentMethod.replaceAll('_', ' ').toLowerCase()}` : ''}</span>
        {order.needsPackaging && <span className="chip"><Icon name="bag" size={12} /> Packaging</span>}
        {order.scheduledAt && <span className="chip chip-accent"><Icon name="calendar" size={12} /> {scheduleLabel(order)} {shortDate(order.scheduledAt)}</span>}
        {order.delayMinutes > 0 && <span className="chip chip-danger"><Icon name="clock" size={12} /> +{order.delayMinutes} min</span>}
      </div>

      {onDelay && canUseKitchen(role) && ['ACCEPTED', 'PREPARING'].includes(order.orderStatus) && <ExtendTime order={order} onDelay={onDelay} />}

      <div className="detail-block">
        <span className="label">Customer</span>
        <strong style={{ fontSize: 15 }}>{order.customerName}</strong>
        {order.tableNumber && <span className="chip chip-forest"><Icon name="qr" size={12} /> Ordered at {order.tableNumber}</span>}
        {order.customerPhone && <a href={`tel:${order.customerPhone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--forest)' }}><Icon name="phone" size={14} />{order.customerPhone}</a>}
        {address && <span style={{ display: 'flex', gap: 6, color: 'var(--muted)' }}><Icon name="pin" size={14} />{address}</span>}
        {order.partySize && <span>Table for {order.partySize}</span>}
      </div>

      {order.customerNotes && (
        <div className="detail-block note">
          <span className="label">Customer note</span>
          <span>{order.customerNotes}</span>
        </div>
      )}

      <div className="line-items">
        <span className="eyebrow">Items</span>
        {order.orderItems.map((item) => (
          <div className="line-item" key={item.id}>
            <span className="qty">{item.quantity}×</span>
            <span>{item.itemName}{item.variantName && <small>{item.variantName}</small>}{item.specialInstructions && <small>“{item.specialInstructions}”</small>}</span>
            <span className="price">{money(item.lineTotal, order.currency)}</span>
          </div>
        ))}
        <div className="totals">
          <div><span>Subtotal</span><span>{money(order.subtotal, order.currency)}</span></div>
          {Number(order.discountAmount) > 0 && <div><span>Discount</span><span>−{money(order.discountAmount, order.currency)}</span></div>}
          {Number(order.taxAmount) > 0 && <div><span>Tax</span><span>{money(order.taxAmount, order.currency)}</span></div>}
          {Number(order.deliveryFee) > 0 && <div><span>Delivery</span><span>{money(order.deliveryFee, order.currency)}</span></div>}
          <div className="grand"><span>Total</span><span>{money(order.totalAmount, order.currency)}</span></div>
        </div>
      </div>

      <div>
        <span className="eyebrow" style={{ marginBottom: 12 }}>Timeline</span>
        <div className="timeline">
          {steps.map(([label, key]) => (
            <div className={`timeline-step${order[key] ? ' done' : ''}`} key={key}><i />{label}{order[key] && <span>{clock(order[key])}</span>}</div>
          ))}
          {order.cancelledAt && <div className="timeline-step stopped"><i />Cancelled{order.cancellationReason && ` — ${order.cancellationReason}`}<span>{clock(order.cancelledAt)}</span></div>}
          {order.rejectionReason && <div className="timeline-step stopped"><i />Rejected — {order.rejectionReason}</div>}
        </div>
      </div>
    </Drawer>
  )
}
