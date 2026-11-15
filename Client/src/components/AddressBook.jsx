import { useState } from 'react'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'
import AddressForm from './AddressForm.jsx'
import { api } from '../lib.js'
import { addressTitle, addressLine, toPoint } from '../geo.js'

const MAX_ADDRESSES = 20 // mirrors address.controllers.ts

// Saved addresses: add, edit, delete, set default, and "deliver here".
// `view` starts as 'list', 'add' or { edit: address }.
export default function AddressBook({ addresses, onChange, location, onDeliverHere, onClose, initialView = 'list' }) {
  const [view, setView] = useState(initialView)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const editing = typeof view === 'object' ? view.edit : null

  async function reload() {
    const result = await api('/addresses')
    onChange(result.data)
  }

  async function run(id, action) {
    setBusy(id)
    setError('')
    try { await action() } catch (err) { setError(err.message) }
    setBusy('')
  }

  const makeDefault = (address) => run(address.id, async () => {
    await api(`/addresses/${address.id}`, { method: 'PATCH', body: { isDefault: true } })
    onChange(addresses.map((item) => ({ ...item, isDefault: item.id === address.id })))
  })

  const remove = (address) => {
    if (!window.confirm(`Delete “${addressTitle(address)}”? Past orders keep their address.`)) return
    run(address.id, async () => {
      await api(`/addresses/${address.id}`, { method: 'DELETE' })
      await reload() // the server may promote another address to default
    })
  }

  // After add/edit: refresh (default may have moved), then deliver there if it's new, current,
  // or the book was opened just for this address. Opened from the list → back to the list.
  async function saved(address) {
    const isNew = !editing
    await reload().catch(() => onChange(isNew ? [...addresses, address] : addresses.map((item) => item.id === address.id ? address : item)))
    if (isNew || location?.addressId === address.id || initialView !== 'list') onDeliverHere(address)
    if (initialView === 'list') setView('list')
    else onClose()
  }

  function deliverHere(address) {
    if (!toPoint(address)) return setView({ edit: address })
    onDeliverHere(address)
    onClose()
  }

  const title = view === 'add' ? 'Add an address' : editing ? `Edit ${addressTitle(editing)}` : 'Your addresses'

  return (
    <Modal title={title} wide onClose={onClose}>
      {view === 'add' || editing ? (
        <AddressForm key={editing?.id ?? 'new'} address={editing} start={location} onSaved={saved} onCancel={() => initialView === 'list' ? setView('list') : onClose()} />
      ) : <>
        {addresses.length === 0 ? (
          <p className="hint">No saved addresses yet. Add one to get food delivered and see the kitchens nearest to it.</p>
        ) : (
          <ul className="address-book">
            {addresses.map((address) => {
              const pinned = Boolean(toPoint(address))
              const current = location?.addressId === address.id
              return (
                <li key={address.id} className={current ? 'current' : ''}>
                  <span className="address-icon"><Icon name={address.addressType === 'WORK' ? 'store' : 'pin'} size={16} /></span>
                  <div className="address-text">
                    <strong>{addressTitle(address)}{address.isDefault && <span className="chip">Default</span>}{current && <span className="chip chip-muted">Delivering here</span>}</strong>
                    <small>{addressLine(address)}</small>
                    {!pinned && <small className="reach out">No map pin — add one to check which kitchens deliver here</small>}
                    <div className="address-actions">
                      {!current && <button type="button" className="link" onClick={() => deliverHere(address)} disabled={busy === address.id}>{pinned ? 'Deliver here' : 'Add pin'}</button>}
                      <button type="button" className="text-btn" onClick={() => setView({ edit: address })}>Edit</button>
                      {!address.isDefault && <button type="button" className="text-btn" onClick={() => makeDefault(address)} disabled={busy === address.id}>Make default</button>}
                      <button type="button" className="text-btn danger" onClick={() => remove(address)} disabled={busy === address.id}>Delete</button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Done</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setView('add')} disabled={addresses.length >= MAX_ADDRESSES}>+ Add address</button>
        </div>
      </>}
    </Modal>
  )
}
