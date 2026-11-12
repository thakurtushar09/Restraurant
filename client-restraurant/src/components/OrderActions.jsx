import { useState } from 'react'
import { Modal } from './Overlay.jsx'
import { nextActions } from '../lib.js'

const QUICK_REASONS = {
  REJECTED: ['Kitchen is too busy', 'Item out of stock', 'Closing soon'],
  CANCELLED: ['Customer requested', 'Ingredient ran out', 'Delivery not possible'],
}

export default function OrderActions({ order, role, onUpdate, size = 'sm' }) {
  const [pending, setPending] = useState(null)
  const [reasonFor, setReasonFor] = useState(null)
  const [reason, setReason] = useState('')
  const actions = nextActions(order, role)

  if (actions.length === 0) return null

  async function run(action, text) {
    setPending(action.status)
    const ok = await onUpdate(order, action.status, text)
    setPending(null)
    if (ok) {
      setReasonFor(null)
      setReason('')
    }
  }

  function click(event, action) {
    event.stopPropagation()
    if (action.needsReason) setReasonFor(action)
    else run(action)
  }

  return (
    <>
      <div className="order-actions" onClick={(event) => event.stopPropagation()}>
        {actions.map((action) => (
          <button key={action.status} className={`btn btn-${action.tone} ${size === 'sm' ? 'btn-sm' : ''}`} disabled={pending !== null} onClick={(event) => click(event, action)}>
            {pending === action.status ? '…' : action.label}
          </button>
        ))}
      </div>
      {reasonFor && (
        <Modal title={`${reasonFor.label} order ${order.orderNumber.slice(-8)}?`} onClose={() => setReasonFor(null)}>
          <form onSubmit={(event) => { event.preventDefault(); run(reasonFor, reason.trim()) }} onClick={(event) => event.stopPropagation()} style={{ display: 'grid', gap: 14 }}>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>The customer will see this reason.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_REASONS[reasonFor.status].map((text) => (
                <button type="button" key={text} className={`chip ${reason === text ? 'chip-forest' : ''}`} style={{ border: 0 }} onClick={() => setReason(text)}>{text}</button>
              ))}
            </div>
            <label className="field">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} required={reasonFor.status === 'REJECTED'} autoFocus /></label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setReasonFor(null)}>Keep order</button>
              <button className="btn btn-danger" disabled={pending !== null || (reasonFor.status === 'REJECTED' && !reason.trim())}>{pending ? 'Saving…' : reasonFor.label}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
