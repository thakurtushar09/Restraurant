import { useEffect, useState } from 'react'
import Icon from '../components/Icon.jsx'
import SlotPicker from '../components/SlotPicker.jsx'
import PageHero from '../components/PageHero.jsx'
import { api, money, isOpenAt, formatInZone } from '../lib.js'

const EMPTY_ADDRESS = { addressType: 'HOME', addressLine1: '', addressLine2: '', landmark: '', city: '', state: '', postalCode: '' }

function AddressForm({ onSaved, onCancel }) {
  const [form, setForm] = useState(EMPTY_ADDRESS)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await api('/addresses', { method: 'POST', body: form })
      onSaved(result.data)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="address-form" onSubmit={save}>
      <div className="segmented" role="group" aria-label="Address type">
        {[['HOME', 'Home'], ['WORK', 'Work'], ['OTHER', 'Other']].map(([value, label]) => (
          <button type="button" key={value} className={form.addressType === value ? 'active' : ''} onClick={() => setForm({ ...form, addressType: value })}>{label}</button>
        ))}
      </div>
      <div className="form-grid">
        <label className="field span-2">House / flat, street<input value={form.addressLine1} onChange={set('addressLine1')} required autoFocus /></label>
        <label className="field">Area <small>optional</small><input value={form.addressLine2} onChange={set('addressLine2')} /></label>
        <label className="field">Landmark <small>optional</small><input value={form.landmark} onChange={set('landmark')} /></label>
        <label className="field">City<input value={form.city} onChange={set('city')} required /></label>
        <label className="field">State<input value={form.state} onChange={set('state')} required /></label>
        <label className="field">Postal code<input value={form.postalCode} onChange={set('postalCode')} required /></label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="row-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save address'}</button>
      </div>
    </form>
  )
}

export default function CheckoutPage({ cart, user, navigate, onPlaced }) {
  const branch = cart.branch
  const [mode, setMode] = useState(branch?.acceptsDineIn ? 'DINE_IN' : 'DELIVERY')
  const [timing, setTiming] = useState('asap') // delivery only: 'asap' | 'later'
  const [slot, setSlot] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [addresses, setAddresses] = useState(null)
  const [addressId, setAddressId] = useState('')
  const [addingAddress, setAddingAddress] = useState(false)
  const [contact, setContact] = useState({ customerName: user?.fullName ?? '', customerPhone: '', customerNotes: '' })
  const [error, setError] = useState('')
  const [placing, setPlacing] = useState(false)

  const preorder = mode === 'DINE_IN'
  const openNow = branch ? isOpenAt(branch.openingHours, branch.timezone, new Date()) : false

  // Saved addresses, only needed for delivery.
  useEffect(() => {
    if (mode !== 'DELIVERY' || addresses) return undefined
    const controller = new AbortController()
    api('/addresses', { signal: controller.signal })
      .then((result) => {
        setAddresses(result.data)
        setAddressId(result.data.find((address) => address.isDefault)?.id ?? result.data[0]?.id ?? '')
        if (result.data.length === 0) setAddingAddress(true)
      })
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message) })
    return () => controller.abort()
  }, [mode, addresses])

  if (!branch || cart.items.length === 0) {
    return (
      <main className="wrap" style={{ padding: '56px 0 80px' }}>
        <div className="state" style={{ background: 'var(--white)' }}><span className="state-icon"><Icon name="bag" /></span><h2>Your cart is empty</h2><p>Add a few dishes before checking out.</p><button className="btn btn-primary" onClick={() => navigate('explore')}>Explore food</button></div>
      </main>
    )
  }

  const total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  const needsSlot = preorder || timing === 'later' || !openNow
  const setField = (key) => (event) => setContact((current) => ({ ...current, [key]: event.target.value }))

  async function placeOrder(event) {
    event.preventDefault()
    setError('')
    if (needsSlot && !slot) return setError(preorder ? 'Choose when you’ll arrive.' : 'Choose a delivery time.')
    if (!preorder && !addressId) return setError('Add a delivery address.')
    setPlacing(true)
    try {
      const result = await api('/orders/checkout', {
        method: 'POST',
        body: {
          branchId: branch.id,
          fulfillmentType: mode,
          paymentMethod: preorder ? 'PAY_AT_COUNTER' : 'CASH',
          ...(preorder ? {} : { addressId }),
          ...(needsSlot ? { scheduledAt: slot } : {}),
          ...(preorder ? { partySize } : {}),
          customerName: contact.customerName.trim(),
          customerPhone: contact.customerPhone.trim(),
          customerNotes: contact.customerNotes.trim() || undefined,
          items: cart.items.map((item) => ({ menuItemId: item.menuItemId, ...(item.variantId ? { variantId: item.variantId } : {}), quantity: item.quantity })),
        },
      })
      onPlaced(result.data)
    } catch (err) {
      setError(err.message)
      setPlacing(false)
    }
  }

  return (
    <main>
      <PageHero
        compact
        back="Back to cart"
        onBack={() => navigate('cart')}
        eyebrow="Checkout"
        title={<>Almost <em>there.</em></>}
        lede={`${preorder ? 'Pre-ordering' : 'Ordering'} from ${branch.groupName} · ${branch.branchName}`}
      />
      <div className="wrap overlap">
      <form className="cart-layout" onSubmit={placeOrder}>
        <div className="checkout-steps">
          <section className="panel reveal">
            <h3><span className="num">1</span>How would you like it?</h3>
            <div className="mode-cards">
              {branch.acceptsDineIn && (
                <button type="button" className={`mode-card${preorder ? ' active' : ''}`} onClick={() => setMode('DINE_IN')}>
                  <Icon name="calendar" size={22} />
                  <strong>Pre-order</strong>
                  <small>Order now, eat at {branch.branchName}. Your food is ready when you arrive.</small>
                </button>
              )}
              {branch.acceptsDelivery && (
                <button type="button" className={`mode-card${!preorder ? ' active' : ''}`} onClick={() => setMode('DELIVERY')}>
                  <Icon name="bike" size={22} />
                  <strong>Delivery</strong>
                  <small>Brought to your door, as soon as possible or at a time you choose.</small>
                </button>
              )}
            </div>
          </section>

          <section className="panel reveal">
            <h3><span className="num">2</span>{preorder ? 'When will you arrive?' : 'When should it arrive?'}</h3>
            {!preorder && (
              <div className="segmented" style={{ marginBottom: 14 }}>
                <button type="button" className={timing === 'asap' && openNow ? 'active' : ''} disabled={!openNow} onClick={() => setTiming('asap')}>As soon as possible</button>
                <button type="button" className={timing === 'later' || !openNow ? 'active' : ''} onClick={() => setTiming('later')}>Schedule</button>
              </div>
            )}
            {!preorder && !openNow && <p className="hint" style={{ marginBottom: 12 }}>The restaurant is closed right now, so pick a time when it’s open.</p>}
            {needsSlot ? (
              <>
                {preorder && <>
                  <div className="guests">
                    <span>How many guests?</span>
                    <div className="stepper">
                      <button type="button" onClick={() => setPartySize((n) => Math.max(1, n - 1))} aria-label="Fewer guests" disabled={partySize <= 1}>−</button>
                      <span aria-live="polite">{partySize}</span>
                      <button type="button" onClick={() => setPartySize((n) => Math.min(20, n + 1))} aria-label="More guests" disabled={partySize >= 20}>+</button>
                    </div>
                  </div>
                  <p className="hint" style={{ marginBottom: 12 }}>The kitchen starts cooking about {branch.averagePreparationTimeMinutes} minutes before you arrive, so your food is fresh and ready.</p>
                </>}
                <SlotPicker branch={branch} value={slot} onChange={setSlot} />
              </>
            ) : (
              <p className="hint">Usually ready in about {branch.averagePreparationTimeMinutes} minutes, plus delivery time.</p>
            )}
          </section>

          {!preorder && (
            <section className="panel reveal">
              <h3><span className="num">3</span>Delivery address</h3>
              {addresses === null ? <div className="skeleton" style={{ height: 64 }} /> : <>
                <div className="choice-list">
                  {addresses.map((address) => (
                    <label key={address.id} className={`choice${addressId === address.id ? ' active' : ''}`}>
                      <input type="radio" name="address" checked={addressId === address.id} onChange={() => setAddressId(address.id)} />
                      <span className="radio" />
                      <span className="name"><strong>{address.label || address.addressType.charAt(0) + address.addressType.slice(1).toLowerCase()}</strong><small>{[address.addressLine1, address.addressLine2, address.city, address.postalCode].filter(Boolean).join(', ')}</small></span>
                    </label>
                  ))}
                </div>
                {addingAddress
                  ? <AddressForm onCancel={() => setAddingAddress(false)} onSaved={(address) => { setAddresses((current) => [...current, address]); setAddressId(address.id); setAddingAddress(false) }} />
                  : <button type="button" className="link" style={{ marginTop: 12 }} onClick={() => setAddingAddress(true)}>+ Add a new address</button>}
              </>}
            </section>
          )}

          <section className="panel reveal">
            <h3><span className="num">{preorder ? 3 : 4}</span>Your details</h3>
            <div className="form-grid">
              <label className="field">Name<input value={contact.customerName} onChange={setField('customerName')} autoComplete="name" required /></label>
              <label className="field">Phone<input type="tel" value={contact.customerPhone} onChange={setField('customerPhone')} autoComplete="tel" pattern="\+?[0-9][0-9\s\-]{6,18}" title="A valid phone number" placeholder="+91 98450 12345" required /></label>
              <label className="field span-2">Note for the kitchen <small>optional</small><input value={contact.customerNotes} onChange={setField('customerNotes')} placeholder={preorder ? 'Allergies, celebrations, seating preferences…' : 'Allergies, gate code, spice level…'} maxLength={300} /></label>
            </div>
          </section>
        </div>

        <aside className="receipt">
          <span className="eyebrow plain">{branch.groupName} · {branch.branchName}</span>
          <h2>{preorder ? 'Your pre-order' : 'Your delivery'}</h2>
          <span className="sub">{count} {count === 1 ? 'item' : 'items'}{preorder ? ` · Table for ${partySize}` : ''}{slot && needsSlot ? ` · ${preorder ? 'Arriving' : 'For'} ${formatInZone(slot, branch.timezone)}` : ''}</span>
          <div className="rule" />
          <div className="rows">
            {cart.items.map((item) => (
              <div className="row" key={item.key}><b>{item.quantity}×</b><span className="name">{item.name}{item.variantName && <small> · {item.variantName}</small>}</span><span className="amt">{money(item.price * item.quantity)}</span></div>
            ))}
          </div>
          <div className="rule" />
          <div className="total"><span>Total</span><strong>{money(total)}</strong></div>
          <p className="note">{preorder ? 'Pay at the restaurant when you’re done.' : 'Pay in cash when your order arrives.'}</p>
          {error && <p className="form-error" role="alert" style={{ marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-primary btn-block" disabled={placing}>
            {placing ? 'Placing order…' : preorder ? 'Confirm pre-order' : 'Place order'} <Icon name="arrow" size={16} />
          </button>
          <p className="thanks">Thank you for eating local</p>
        </aside>
      </form>
      </div>
    </main>
  )
}
