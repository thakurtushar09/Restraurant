import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import SlotPicker from '../components/SlotPicker.jsx'
import PageHero from '../components/PageHero.jsx'
import Modal from '../components/Modal.jsx'
import AddressForm from '../components/AddressForm.jsx'
import { api, money, isOpenAt, formatInZone } from '../lib.js'
import { distanceKm, formatDistance, toPoint, addressTitle, addressLine, addressToLocation } from '../geo.js'

// { km, inRange } for an address against the branch's delivery area; null when either has no pin.
function deliveryReach(branch, place) {
  const from = toPoint(branch)
  const to = toPoint(place)
  if (!from || !to || !branch.deliveryRadiusKm) return null
  const km = distanceKm(from, to)
  return { km, inRange: km <= branch.deliveryRadiusKm }
}

function ReachNote({ branch, reach }) {
  if (!reach) return null
  return <small className={`reach${reach.inRange ? '' : ' out'}`}>{formatDistance(reach.km)} from {branch.branchName} · {reach.inRange ? 'within delivery area' : `outside the ${branch.deliveryRadiusKm} km delivery area`}</small>
}

// Unpinned addresses can't be checked against a pinned branch, so they're blocked too.
const isBlocked = (branch, address) => deliveryReach(branch, address)?.inRange === false || Boolean(toPoint(branch) && !toPoint(address))

export default function CheckoutPage({ cart, user, navigate, onPlaced, location, setLocation, addresses, onAddressesChange, dineIn }) {
  const branch = cart.branch
  // Scanned this branch's QR: order to the guest's table now, no time slot or address.
  const atRestaurant = Boolean(dineIn && branch && dineIn.publicSlug === branch.slug)
  const [mode, setMode] = useState(atRestaurant ? 'TABLE' : branch?.acceptsDineIn ? 'DINE_IN' : 'DELIVERY')
  const [timing, setTiming] = useState('asap') // delivery only: 'asap' | 'later'
  const [slot, setSlot] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [tableNumber, setTableNumber] = useState('')
  const [picked, setPicked] = useState('')
  const [addingAddress, setAddingAddress] = useState(false)
  const [pinning, setPinning] = useState(null)
  const [contact, setContact] = useState({ customerName: user?.fullName ?? '', customerPhone: '', customerNotes: '' })
  const [error, setError] = useState('')
  const [placing, setPlacing] = useState(false)
  const errorRef = useRef(null)

  // On phones the order is placed from the sticky bar, so bring the error into view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  const preorder = mode === 'DINE_IN'
  const tableOrder = mode === 'TABLE' && atRestaurant
  const openNow = branch ? isOpenAt(branch.openingHours, branch.timezone, new Date()) : false

  // Picked here > the navbar's address > the default > the first, among ones this branch delivers to.
  const usable = (addresses ?? []).filter((address) => !isBlocked(branch, address))
  const addressId = [picked, location?.addressId, usable.find((address) => address.isDefault)?.id, usable[0]?.id]
    .find((id) => id && usable.some((address) => address.id === id)) ?? ''
  const showAddressForm = addingAddress || addresses?.length === 0

  // Reload after a save (it may have become the default), then pick it if this branch delivers there.
  async function addressSaved(address) {
    try {
      onAddressesChange((await api('/addresses')).data)
    } catch {
      onAddressesChange([...(addresses ?? []).filter((item) => item.id !== address.id), address])
    }
    if (!isBlocked(branch, address)) selectAddress(address)
  }

  // Choosing an address here also moves the navbar location to it.
  function selectAddress(address) {
    setPicked(address.id)
    const next = addressToLocation(address)
    if (next) setLocation(next)
  }

  if (!branch || cart.items.length === 0) {
    return (
      <main className="wrap" style={{ padding: '56px 0 80px' }}>
        <div className="state" style={{ background: 'var(--white)' }}><span className="state-icon"><Icon name="bag" /></span><h2>Your cart is empty</h2><p>Add a few dishes before checking out.</p><button className="btn btn-primary" onClick={() => navigate('explore')}>Explore food</button></div>
      </main>
    )
  }

  const total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0)
  const needsSlot = !tableOrder && (preorder || timing === 'later' || !openNow)
  const setField = (key) => (event) => setContact((current) => ({ ...current, [key]: event.target.value }))

  async function placeOrder(event) {
    event.preventDefault()
    setError('')
    if (tableOrder && !openNow) return setError('The kitchen is closed right now, so it can’t take table orders.')
    if (tableOrder && !tableNumber.trim()) return setError('Enter your table number.')
    if (needsSlot && !slot) return setError(preorder ? 'Choose when you’ll arrive.' : 'Choose a delivery time.')
    if (mode === 'DELIVERY' && !addressId) return setError('Add a delivery address.')
    const chosen = addresses?.find((address) => address.id === addressId)
    if (mode === 'DELIVERY' && chosen && deliveryReach(branch, chosen)?.inRange === false) return setError('That address is outside the delivery area. Choose another or switch to pre-order.')
    setPlacing(true)
    try {
      const result = await api('/orders/checkout', {
        method: 'POST',
        body: {
          branchId: branch.id,
          fulfillmentType: mode === 'DELIVERY' ? 'DELIVERY' : 'DINE_IN',
          paymentMethod: mode === 'DELIVERY' ? 'CASH' : 'PAY_AT_COUNTER',
          ...(mode === 'DELIVERY' ? { addressId } : {}),
          ...(needsSlot ? { scheduledAt: slot } : {}),
          ...(preorder || tableOrder ? { partySize } : {}),
          ...(tableOrder ? { tableNumber: tableNumber.trim() } : {}),
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
              {atRestaurant && (
                <button type="button" className={`mode-card${tableOrder ? ' active' : ''}`} onClick={() => setMode('TABLE')}>
                  <Icon name="qr" size={22} />
                  <strong>At my table</strong>
                  <small>You’re here now. Your food comes straight to your table.</small>
                </button>
              )}
              {branch.acceptsDineIn && (
                <button type="button" className={`mode-card${preorder ? ' active' : ''}`} onClick={() => setMode('DINE_IN')}>
                  <Icon name="calendar" size={22} />
                  <strong>Pre-order</strong>
                  <small>Order now, eat at {branch.branchName}. Your food is ready when you arrive.</small>
                </button>
              )}
              {branch.acceptsDelivery && (
                <button type="button" className={`mode-card${mode === 'DELIVERY' ? ' active' : ''}`} onClick={() => setMode('DELIVERY')}>
                  <Icon name="bike" size={22} />
                  <strong>Delivery</strong>
                  <small>Brought to your door, as soon as possible or at a time you choose.</small>
                </button>
              )}
            </div>
          </section>

          {tableOrder ? (
          <section className="panel reveal">
            <h3><span className="num">2</span>Where are you sitting?</h3>
            <label className="field table-field">Table number<input value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} maxLength={20} placeholder="e.g. 12" autoComplete="off" required /><small>It’s usually on the table or the QR sticker.</small></label>
            <div className="guests">
              <span>Guests</span>
              <div className="stepper">
                <button type="button" onClick={() => setPartySize((n) => Math.max(1, n - 1))} aria-label="Fewer guests" disabled={partySize <= 1}>−</button>
                <span aria-live="polite">{partySize}</span>
                <button type="button" onClick={() => setPartySize((n) => Math.min(20, n + 1))} aria-label="More guests" disabled={partySize >= 20}>+</button>
              </div>
            </div>
            <p className="hint">{openNow ? `The kitchen starts as soon as it confirms — usually ready in about ${branch.averagePreparationTimeMinutes} minutes.` : 'The kitchen is closed right now, so it can’t take table orders.'}</p>
          </section>
          ) : (
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
          )}

          {mode === 'DELIVERY' && (
            <section className="panel reveal">
              <h3><span className="num">3</span>Delivery address</h3>
              {addresses === null ? <div className="skeleton" style={{ height: 64 }} /> : <>
                <div className="choice-list">
                  {addresses.map((address) => {
                    const reach = deliveryReach(branch, address)
                    const needsPin = toPoint(branch) && !toPoint(address)
                    const blocked = isBlocked(branch, address)
                    return (
                      <label key={address.id} className={`choice${addressId === address.id ? ' active' : ''}${blocked ? ' disabled' : ''}`}>
                        <input type="radio" name="address" checked={addressId === address.id} disabled={blocked} onChange={() => selectAddress(address)} />
                        <span className="radio" />
                        <span className="name">
                          <strong>{addressTitle(address)}</strong>
                          <small>{addressLine(address)}</small>
                          <ReachNote branch={branch} reach={reach} />
                          {needsPin && <button type="button" className="link" onClick={(event) => { event.preventDefault(); setPinning(address) }}>Pin on map to check delivery</button>}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {showAddressForm
                  ? <AddressForm start={location} note={(pin) => <ReachNote branch={branch} reach={pin && deliveryReach(branch, pin)} />} onCancel={() => setAddingAddress(false)} onSaved={(address) => { addressSaved(address); setAddingAddress(false) }} />
                  : <button type="button" className="link" style={{ marginTop: 12 }} onClick={() => setAddingAddress(true)}>+ Add a new address</button>}
              </>}
            </section>
          )}

          <section className="panel reveal">
            <h3><span className="num">{mode === 'DELIVERY' ? 4 : 3}</span>Your details</h3>
            <div className="form-grid">
              <label className="field">Name<input value={contact.customerName} onChange={setField('customerName')} autoComplete="name" required /></label>
              <label className="field">Phone{tableOrder && <small>optional</small>}<input type="tel" value={contact.customerPhone} onChange={setField('customerPhone')} autoComplete="tel" pattern="\+?[0-9][0-9\s\-]{6,18}" title="A valid phone number" placeholder="+91 98450 12345" required={!tableOrder} /></label>
              <label className="field span-2">Note for the kitchen <small>optional</small><input value={contact.customerNotes} onChange={setField('customerNotes')} placeholder={mode === 'DELIVERY' ? 'Allergies, gate code, spice level…' : 'Allergies, celebrations, seating preferences…'} maxLength={300} /></label>
            </div>
          </section>
        </div>

        <aside className="receipt">
          <span className="eyebrow plain">{branch.groupName} · {branch.branchName}</span>
          <h2>{tableOrder ? (tableNumber.trim() ? `Order for table ${tableNumber.trim().replace(/^table\s*/i, '')}` : 'Your table order') : preorder ? 'Your pre-order' : 'Your delivery'}</h2>
          <span className="sub">{count} {count === 1 ? 'item' : 'items'}{preorder || tableOrder ? ` · ${partySize} ${partySize === 1 ? 'guest' : 'guests'}` : ''}{slot && needsSlot ? ` · ${preorder ? 'Arriving' : 'For'} ${formatInZone(slot, branch.timezone)}` : ''}</span>
          <div className="rule" />
          <div className="rows">
            {cart.items.map((item) => (
              <div className="row" key={item.key}><b>{item.quantity}×</b><span className="name">{item.name}{item.variantName && <small> · {item.variantName}</small>}</span><span className="amt">{money(item.price * item.quantity)}</span></div>
            ))}
          </div>
          <div className="rule" />
          <div className="total"><span>Total</span><strong>{money(total)}</strong></div>
          <p className="note">{mode === 'DELIVERY' ? 'Pay in cash when your order arrives.' : 'Pay at the restaurant when you’re done.'}</p>
          {error && <p className="form-error" role="alert" ref={errorRef} style={{ marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-primary btn-block" disabled={placing}>
            {placing ? 'Placing order…' : tableOrder ? 'Send to the kitchen' : preorder ? 'Confirm pre-order' : 'Place order'} <Icon name="arrow" size={16} />
          </button>
          <p className="thanks">Thank you for eating local</p>
        </aside>
        <div className="checkout-bar">
          <span><small>{count} {count === 1 ? 'item' : 'items'}</small><strong>{money(total)}</strong></span>
          <button className="btn btn-primary" disabled={placing}>
            {placing ? 'Placing…' : tableOrder ? 'Send to kitchen' : preorder ? 'Confirm pre-order' : 'Place order'} <Icon name="arrow" size={16} />
          </button>
        </div>
      </form>
      </div>
      {pinning && (
        <Modal title={`Pin ${addressTitle(pinning)}`} wide onClose={() => setPinning(null)}>
          <AddressForm address={pinning} start={location} autoFocus={false} note={(pin) => <ReachNote branch={branch} reach={pin && deliveryReach(branch, pin)} />} onCancel={() => setPinning(null)} onSaved={(address) => { addressSaved(address); setPinning(null) }} />
        </Modal>
      )}
    </main>
  )
}
