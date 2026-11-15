import { useRef, useState } from 'react'
import LocationPicker from './LocationPicker.jsx'
import { api } from '../lib.js'
import { toPoint } from '../geo.js'

const FIELDS = ['addressType', 'label', 'addressLine1', 'addressLine2', 'landmark', 'city', 'state', 'postalCode', 'deliveryInstructions']

function initialForm(address) {
  const form = { addressType: 'HOME', label: '', addressLine1: '', addressLine2: '', landmark: '', city: '', state: '', postalCode: '', deliveryInstructions: '' }
  for (const key of FIELDS) if (address?.[key] != null) form[key] = String(address[key])
  return form
}

// Add (no `address`) or edit a saved address. Not a <form>, so it can sit inside checkout's form;
// fields are validated by hand on save. `note(pin)` renders extra text under the map, e.g. delivery reach.
export default function AddressForm({ address, start, note, onSaved, onCancel, autoFocus = true }) {
  const rootRef = useRef(null)
  const [form, setForm] = useState(() => initialForm(address))
  const [pin, setPin] = useState(() => toPoint(address) ?? (start ? { latitude: start.latitude, longitude: start.longitude } : null))
  const [makeDefault, setMakeDefault] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  // Only parts the lookup found replace what the customer typed.
  const fillAddress = (found) => setForm((current) => ({ ...current, ...Object.fromEntries(Object.entries(found).filter(([key, part]) => part && key in current)) }))
  const pinned = pin?.latitude != null

  async function save() {
    const invalid = [...rootRef.current.querySelectorAll('.address-fields input')].find((input) => !input.checkValidity())
    if (invalid) return invalid.reportValidity()
    if (!pinned) return setError('Drop a pin on your door so the rider can find you.')
    setSaving(true)
    setError('')
    try {
      const body = { ...form, latitude: pin.latitude, longitude: pin.longitude, ...(makeDefault ? { isDefault: true } : {}) }
      const result = address
        ? await api(`/addresses/${address.id}`, { method: 'PATCH', body })
        : await api('/addresses', { method: 'POST', body })
      onSaved(result.data)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="address-form" ref={rootRef} onKeyDown={(event) => { if (event.key === 'Enter' && event.target.matches('.address-fields input') && !event.target.closest('.location-picker')) { event.preventDefault(); save() } }}>
      <div className="segmented" role="group" aria-label="Address type">
        {[['HOME', 'Home'], ['WORK', 'Work'], ['OTHER', 'Other']].map(([value, label]) => (
          <button type="button" key={value} className={form.addressType === value ? 'active' : ''} aria-pressed={form.addressType === value} onClick={() => setForm({ ...form, addressType: value })}>{label}</button>
        ))}
      </div>
      <div className="form-grid address-fields">
        <label className="field span-2">House / flat, street<input value={form.addressLine1} onChange={set('addressLine1')} required autoFocus={autoFocus} /></label>
        <label className="field">Area <small>optional</small><input value={form.addressLine2} onChange={set('addressLine2')} /></label>
        <label className="field">Landmark <small>optional</small><input value={form.landmark} onChange={set('landmark')} /></label>
        <label className="field">City<input value={form.city} onChange={set('city')} required /></label>
        <label className="field">State<input value={form.state} onChange={set('state')} required /></label>
        <label className="field">Postal code<input value={form.postalCode} onChange={set('postalCode')} required /></label>
        <label className="field">Name it <small>optional</small><input value={form.label} onChange={set('label')} placeholder="e.g. Mum’s place" maxLength={50} /></label>
        <label className="field span-2">Instructions for the rider <small>optional</small><input value={form.deliveryInstructions} onChange={set('deliveryInstructions')} placeholder="Gate code, floor, call on arrival…" maxLength={300} /></label>
        <div className="field span-2">
          Pin on the map
          <LocationPicker value={pin} onChange={setPin} onAddress={fillAddress} />
          {note?.(pinned ? pin : null)}
        </div>
        {!address?.isDefault && (
          <label className="check-row span-2"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} />Make this my default address</label>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="row-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : address ? 'Save changes' : 'Save address'}</button>
      </div>
    </div>
  )
}
