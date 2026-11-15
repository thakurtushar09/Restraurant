import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import SlotPicker from '../components/SlotPicker.jsx'
import PageHero from '../components/PageHero.jsx'
import { api, money, statusLabel, formatInZone, ACTIVE_STATUSES } from '../lib.js'

const STEPS = {
  DINE_IN: [['PENDING', 'Order placed'], ['ACCEPTED', 'Confirmed'], ['PREPARING', 'Being prepared'], ['READY', 'Ready for you'], ['COMPLETED', 'Enjoyed']],
  DELIVERY: [['PENDING', 'Order placed'], ['ACCEPTED', 'Confirmed'], ['PREPARING', 'Being prepared'], ['READY', 'Ready'], ['OUT_FOR_DELIVERY', 'On the way'], ['COMPLETED', 'Delivered']],
}

export default function OrderDetailPage({ orderId, navigate, notify }) {
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [rescheduling, setRescheduling] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [newSlot, setNewSlot] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async (signal) => {
    try {
      const result = await api(`/customer-orders/${orderId}`, { signal })
      setOrder(result.data)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message)
    }
  }, [orderId])

  // Refresh while the order is still moving so status changes appear on their own.
  const active = order ? ACTIVE_STATUSES.includes(order.orderStatus) : true
  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => load(controller.signal))
    const timer = active ? window.setInterval(() => load(controller.signal), 30000) : null
    return () => { controller.abort(); if (timer) window.clearInterval(timer) }
  }, [load, active])

  // Live updates from the notification stream refresh this order straight away.
  useEffect(() => {
    const onUpdate = (event) => { if (event.detail.orderId === orderId) load() }
    window.addEventListener('order-update', onUpdate)
    return () => window.removeEventListener('order-update', onUpdate)
  }, [load, orderId])

  async function reschedule() {
    setBusy(true)
    setActionError('')
    try {
      await api(`/customer-orders/${orderId}/reschedule`, { method: 'PATCH', body: { scheduledAt: newSlot } })
      await load()
      setRescheduling(false)
      notify('Your time has been updated')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    setBusy(true)
    setActionError('')
    try {
      await api(`/customer-orders/${orderId}/cancel`, { method: 'PATCH', body: {} })
      await load()
      setCancelling(false)
      notify('Your order has been cancelled')
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return <main className="wrap" style={{ padding: '56px 0 80px' }}><div className="state"><span className="state-icon"><Icon name="alert" /></span><h2>Couldn’t load this order</h2><p>{error}</p><button className="btn btn-primary" onClick={() => navigate('orders')}>My orders</button></div></main>
  }
  if (!order) {
    return <main className="wrap" style={{ padding: '56px 0 80px', display: 'grid', gap: 16 }}><div className="skeleton" style={{ height: 180 }} /><div className="skeleton" style={{ height: 240 }} /></main>
  }

  const preorder = order.fulfillmentType === 'DINE_IN'
  const { branch } = order
  const steps = STEPS[order.fulfillmentType] ?? STEPS.DELIVERY
  const reached = steps.findIndex(([status]) => status === order.orderStatus)
  const stopped = ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(order.orderStatus)
  const canChange = order.orderStatus === 'PENDING'

  return (
    <main>
      <div className="order-band">
      <PageHero
        compact
        back="My orders"
        onBack={() => navigate('orders')}
        eyebrow={<>{ACTIVE_STATUSES.includes(order.orderStatus) && <span className="live" />}{order.tableNumber ? 'Table order' : preorder ? 'Pre-order' : 'Delivery'} · #{order.orderNumber.slice(-8)}</>}
        title={statusLabel(order)}
      >
          {order.tableNumber && <p className="when"><Icon name="qr" size={18} />{order.tableNumber}{order.partySize ? ` · ${order.partySize} ${order.partySize === 1 ? 'guest' : 'guests'}` : ''}</p>}
          {order.scheduledAt && (
            <p className="when"><Icon name="calendar" size={18} />{preorder ? (order.partySize ? `Table for ${order.partySize} · ` : 'Your table · ') : 'Arriving '}{formatInZone(order.scheduledAt, branch.timezone)}</p>
          )}
          <p className="where"><Icon name="pin" size={16} />{branch.restaurantGroup.groupName} · {branch.branchName}, {[branch.addressLine1, branch.city].filter(Boolean).join(', ')}</p>
          {preorder && !order.tableNumber && !stopped && order.orderStatus !== 'COMPLETED' && <p className="band-note">Walk in at your time and give your name — your food will be ready.</p>}
          {order.tableNumber && !stopped && order.orderStatus !== 'COMPLETED' && <p className="band-note">Sit tight — staff will bring it to {order.tableNumber}. Pay at the counter when you’re done.</p>}
          {order.rejectionReason && <p className="band-note bad">The restaurant declined: {order.rejectionReason}</p>}
          {order.cancellationReason && ['CANCELLED', 'EXPIRED'].includes(order.orderStatus) && <p className="band-note bad">{order.cancellationReason}{order.orderStatus === 'EXPIRED' ? '. You haven’t been charged — try another time or kitchen.' : ''}</p>}
          {canChange && (
            <div className="actions">
              {order.scheduledAt && <button className="btn btn-ghost" onClick={() => { setNewSlot(order.scheduledAt); setActionError(''); setRescheduling(true) }}>Change time</button>}
              <button className="btn btn-ghost" onClick={() => { setActionError(''); setCancelling(true) }}>Cancel order</button>
            </div>
          )}
      </PageHero>
      </div>

      <div className="wrap overlap" style={{ paddingBottom: 80 }}>
      <div className="cart-layout">
        <section className="panel reveal">
          <h3>Progress</h3>
          {stopped ? <p className="hint">This order won’t be prepared.</p> : (
            <ol className="tracker">
              {steps.map(([status, label], index) => (
                <li key={status} className={index < reached ? 'done' : index === reached ? 'current' : ''}>
                  <span className="dot" />{label}
                </li>
              ))}
            </ol>
          )}
          {branch.phone && <p className="hint" style={{ marginTop: 16 }}>Questions? Call the restaurant at <a href={`tel:${branch.phone}`} className="link">{branch.phone}</a></p>}
        </section>

        <aside className="receipt">
          <span className="eyebrow plain">{preorder ? 'Pay at the restaurant' : 'Cash on delivery'}</span>
          <h2>Order summary</h2>
          <div className="rule" />
          <div className="rows">
            {order.orderItems.map((item) => (
              <div className="row" key={item.id}><b>{item.quantity}×</b><span className="name">{item.itemName}{item.variantName && <small> · {item.variantName}</small>}</span><span className="amt">{money(item.lineTotal)}</span></div>
            ))}
          </div>
          <div className="rule" />
          <div className="total"><span>Total</span><strong>{money(order.totalAmount)}</strong></div>
          {order.customerNotes && <p className="note">Your note: “{order.customerNotes}”</p>}
        </aside>
      </div>
      </div>

      {rescheduling && (
        <Modal title="Change your time" onClose={() => setRescheduling(false)} wide>
          <SlotPicker branch={branch} value={newSlot} onChange={setNewSlot} />
          {actionError && <p className="form-error">{actionError}</p>}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setRescheduling(false)}>Keep current time</button>
            <button className="btn btn-primary" disabled={busy || !newSlot || newSlot === order.scheduledAt} onClick={reschedule}>{busy ? 'Saving…' : 'Update time'}</button>
          </div>
        </Modal>
      )}
      {cancelling && (
        <Modal title="Cancel this order?" onClose={() => setCancelling(false)}>
          <p className="hint">The restaurant hasn’t started on it yet, so you can cancel for free.</p>
          {actionError && <p className="form-error">{actionError}</p>}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setCancelling(false)}>Keep order</button>
            <button className="btn btn-primary danger-fill" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel order'}</button>
          </div>
        </Modal>
      )}
    </main>
  )
}
