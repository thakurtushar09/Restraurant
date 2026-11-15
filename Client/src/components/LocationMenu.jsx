import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import LocationPicker from './LocationPicker.jsx'
import AddressBook from './AddressBook.jsx'
import { currentPosition, placeLabel, addressTitle, addressLine, addressToLocation, toPoint } from '../geo.js'

// Navbar "Deliver to" control. Picking a saved address (or a spot) changes `location`,
// which drives the nearby kitchens on Home/Explore and the default address at checkout.
export default function LocationMenu({ user, addresses, onAddressesChange, location, setLocation, openAuth, open, setOpen }) {
  const rootRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [picking, setPicking] = useState(false) // false = closed; otherwise the draft pin (null until placed)
  const [book, setBook] = useState(null) // AddressBook initial view while open

  useEffect(() => {
    if (!open) return undefined
    const onClick = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open, setOpen])

  async function locate() {
    setBusy(true)
    setError('')
    try {
      const position = await currentPosition()
      setLocation({ ...position, label: await placeLabel(position.latitude, position.longitude) })
      setOpen(false)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  function choose(address) {
    if (!toPoint(address)) {
      setOpen(false)
      setBook({ edit: address })
      return
    }
    setLocation(addressToLocation(address))
    setOpen(false)
  }

  function openBook(view) {
    setOpen(false)
    setBook(view)
  }

  async function savePicked() {
    const pin = picking
    setPicking(false)
    setLocation({ ...pin, label: await placeLabel(pin.latitude, pin.longitude) })
  }

  return (
    <>
      <div className="loc-menu" ref={rootRef}>
        <button type="button" className={`loc-btn${location ? ' set' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
          <Icon name="pin" size={16} />
          <span className="loc-label"><small>{location ? 'Deliver to' : 'Location'}</small><strong>{location?.label || 'Set your location'}</strong></span>
          <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {open && (
          <div className="loc-panel" role="dialog" aria-label="Choose delivery location">
            <div className="loc-head"><strong>Where should we look?</strong><small>Kitchens nearest to this spot are shown first.</small></div>
            {user && addresses?.length > 0 && (
              <ul className="loc-list">
                {addresses.map((address) => {
                  const current = location?.addressId === address.id
                  return (
                    <li key={address.id}>
                      <button type="button" className={current ? 'active' : ''} onClick={() => choose(address)}>
                        <Icon name={address.addressType === 'WORK' ? 'store' : 'pin'} size={15} />
                        <span><strong>{addressTitle(address)}{address.isDefault && <em> · default</em>}</strong><small>{toPoint(address) ? addressLine(address) : 'Needs a map pin — tap to add'}</small></span>
                        {current && <Icon name="check" size={15} />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="loc-options">
              <button type="button" onClick={locate} disabled={busy}><Icon name="pin" size={15} />{busy ? 'Locating…' : 'Use my current location'}</button>
              <button type="button" onClick={() => { setOpen(false); setPicking(location ? { latitude: location.latitude, longitude: location.longitude } : null) }}><Icon name="search" size={15} />Choose a spot on the map</button>
              {user ? <>
                <button type="button" onClick={() => openBook('add')}><Icon name="plate" size={15} />Add a new address</button>
                {addresses?.length > 0 && <button type="button" onClick={() => openBook('list')}><Icon name="receipt" size={15} />Manage addresses</button>}
              </> : (
                <button type="button" onClick={() => { setOpen(false); openAuth('login') }}><Icon name="users" size={15} />Log in to use saved addresses</button>
              )}
              {location && <button type="button" className="muted" onClick={() => { setLocation(null); setOpen(false) }}>Clear location · show all kitchens</button>}
            </div>
            {error && <p className="form-error">{error}</p>}
          </div>
        )}
      </div>

      {picking !== false && (
        <Modal title="Choose a spot" wide onClose={() => setPicking(false)}>
          <LocationPicker value={picking} onChange={setPicking} />
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(false)}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={picking?.latitude == null} onClick={savePicked}>Use this location</button>
          </div>
        </Modal>
      )}
      {book && user && (
        <AddressBook
          addresses={addresses ?? []}
          onChange={onAddressesChange}
          location={location}
          initialView={book}
          onDeliverHere={(address) => { const next = addressToLocation(address); if (next) setLocation(next) }}
          onClose={() => setBook(null)}
        />
      )}
    </>
  )
}
