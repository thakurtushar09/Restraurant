import { useMemo } from 'react'
import Icon from './Icon.jsx'
import LocationPicker from './LocationPicker.jsx'
import { WEEK_DAYS, CURRENCIES, BRANCH_STATUS_LABELS, PHONE_PATTERN, timezones } from '../lib.js'

// Controlled form for branch details. `sections` picks which groups render,
// so onboarding can split them across steps.
export default function BranchForm({ value, onChange, sections = ['contact', 'location', 'operations', 'hours'], showStatus = false }) {
  const zones = useMemo(() => timezones(), [])
  const show = (name) => sections.includes(name)

  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value })
  const toggle = (key) => (event) => onChange({ ...value, [key]: event.target.checked })
  const setDay = (day, patch) => onChange({ ...value, openingHours: { ...value.openingHours, [day]: { ...value.openingHours[day], ...patch } } })

  function copyMondayToAll() {
    const monday = value.openingHours.mon
    onChange({ ...value, openingHours: Object.fromEntries(WEEK_DAYS.map(([day]) => [day, { ...monday }])) })
  }

  const pin = value.latitude !== '' && value.longitude !== '' ? { latitude: Number(value.latitude), longitude: Number(value.longitude) } : null
  const setPin = ({ latitude, longitude }) => onChange({ ...value, latitude: latitude == null ? '' : String(latitude), longitude: longitude == null ? '' : String(longitude) })
  // Only fields the lookup found replace what the owner typed.
  const fillAddress = (address) => onChange({ ...value, ...Object.fromEntries(Object.entries(address).filter(([, part]) => part)) })

  const noFulfillment = !value.acceptsDelivery && !value.acceptsDineIn

  return (
    <div className="form-grid">
      {show('contact') && <>
        <span className="form-section-title">Branch & contact</span>
        <label className="field span-2">Branch name<input value={value.branchName} onChange={set('branchName')} placeholder="e.g. Indiranagar" maxLength={100} required /></label>
        <label className="field">Phone<input type="tel" value={value.phone} onChange={set('phone')} placeholder="+91 98450 12345" pattern={PHONE_PATTERN} title="A valid phone number, digits with optional + and spaces" required /></label>
        <label className="field">Email <small>optional</small><input type="email" value={value.email} onChange={set('email')} placeholder="branch@restaurant.com" /></label>
      </>}

      {show('location') && <>
        <span className="form-section-title">Location</span>
        <label className="field span-2">Address line 1<input value={value.addressLine1} onChange={set('addressLine1')} placeholder="Building, street" required /></label>
        <label className="field">Address line 2 <small>optional</small><input value={value.addressLine2} onChange={set('addressLine2')} placeholder="Area, floor" /></label>
        <label className="field">Landmark <small>optional</small><input value={value.landmark} onChange={set('landmark')} /></label>
        <label className="field">City<input value={value.city} onChange={set('city')} maxLength={100} required /></label>
        <label className="field">State<input value={value.state} onChange={set('state')} maxLength={100} required /></label>
        <label className="field">Postal code<input value={value.postalCode} onChange={set('postalCode')} pattern="[A-Za-z0-9][A-Za-z0-9 \-]{2,9}" title="3–10 letters or digits" required /></label>
        <label className="field">Country<input value={value.country} onChange={set('country')} maxLength={100} required /></label>
        <div className="field span-2">
          Map location
          <LocationPicker value={pin} onChange={setPin} onAddress={fillAddress} radiusKm={value.acceptsDelivery ? Number(value.deliveryRadiusKm) || 0 : 0} />
          {!pin && <small className="form-hint error">Without a pin, customers who search near them won’t see this branch.</small>}
        </div>
      </>}

      {show('operations') && <>
        <span className="form-section-title">Operations</span>
        <div className="field span-2">
          How customers get their food
          <div className="option-cards">
            {[['acceptsDineIn', 'Pre-order', 'Guests order ahead and their food is ready when they arrive'], ['acceptsDelivery', 'Delivery', 'Riders take orders to customers']].map(([key, label, hint]) => (
              <label className={`option-card${value[key] ? ' checked' : ''}`} key={key}>
                <input type="checkbox" checked={value[key]} onChange={toggle(key)} />
                <span className="check"><Icon name="check" size={13} /></span>
                <strong>{label}</strong><small>{hint}</small>
              </label>
            ))}
          </div>
          {noFulfillment && <small className="form-hint error">Turn on at least one option.</small>}
        </div>
        {value.acceptsDelivery && (
          <label className="field span-2">Delivery radius (km)
            <input type="number" min="1" max="50" step="1" value={value.deliveryRadiusKm} onChange={set('deliveryRadiusKm')} required />
            <small>Customers further than this from the pin can still pre-order, but can’t get delivery.</small>
          </label>
        )}
        <label className="field">Average prep time (minutes)<input type="number" min="1" max="240" step="1" value={value.averagePreparationTimeMinutes} onChange={set('averagePreparationTimeMinutes')} required /></label>
        <label className="field">Currency
          <select value={value.currency} onChange={set('currency')}>
            {[...new Set([value.currency, ...CURRENCIES])].map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <label className="field span-2">Timezone
          <select value={value.timezone} onChange={set('timezone')}>
            {[...new Set([value.timezone, ...zones])].map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        {showStatus && (
          <label className="field span-2">Status
            <select value={value.status} onChange={set('status')}>
              {Object.entries(BRANCH_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
            </select>
            <small>Temporarily closed and inactive branches don’t take new orders.</small>
          </label>
        )}
      </>}

      {show('hours') && <>
        <span className="form-section-title hours-title">Opening hours<button type="button" className="text-btn" onClick={copyMondayToAll}>Copy Monday to all days</button></span>
        <div className="hours span-2">
          {WEEK_DAYS.map(([day, label]) => {
            const entry = value.openingHours[day]
            return (
              <div className={`hours-row${entry.closed ? ' closed' : ''}`} key={day}>
                <label className="switch"><input type="checkbox" checked={!entry.closed} onChange={(event) => setDay(day, { closed: !event.target.checked })} /><span className="switch-track" /><span className="day">{label}</span></label>
                {entry.closed ? <span className="closed-label">Closed</span> : <>
                  <input className="input" type="time" value={entry.open} onChange={(event) => setDay(day, { open: event.target.value })} aria-label={`${label} opens`} required />
                  <span className="to">to</span>
                  <input className="input" type="time" value={entry.close} onChange={(event) => setDay(day, { close: event.target.value })} aria-label={`${label} closes`} required />
                </>}
              </div>
            )
          })}
        </div>
      </>}
    </div>
  )
}
