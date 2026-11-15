import { useState } from 'react'
import { canManageMenu } from '../lib.js'

// Branch-wide: accept pre-orders as they arrive and move them to Cooking at their start-cooking time.
export default function AutoAcceptSwitch({ workspace, role, onChange }) {
  const [busy, setBusy] = useState(false)
  if (!canManageMenu(role)) return null

  const on = Boolean(workspace.branch.autoAcceptPreorders)
  const prep = workspace.branch.averagePreparationTimeMinutes ?? 30

  async function toggle(event) {
    setBusy(true)
    await onChange(event.target.checked)
    setBusy(false)
  }

  return (
    <div className={`auto-accept${on ? ' on' : ''}`}>
      <div>
        <strong>Auto-accept pre-orders</strong>
        <small>
          {on
            ? `On: new pre-orders are accepted right away and move to Cooking ${prep} min before the guest’s time.`
            : `Accept pre-orders automatically and start cooking them ${prep} min before the guest’s time.`}
        </small>
      </div>
      <label className="switch">
        <input type="checkbox" checked={on} disabled={busy} onChange={toggle} aria-label="Auto-accept pre-orders" />
        <span className="switch-track" />
      </label>
    </div>
  )
}
