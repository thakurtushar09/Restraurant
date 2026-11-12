import { useState } from 'react'
import Icon from './Icon.jsx'
import { api } from '../lib.js'

// Reminder until the customer confirms their email; order emails only go to confirmed addresses.
export default function VerifyBanner({ email, notify }) {
  const [sending, setSending] = useState(false)
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  async function resend() {
    setSending(true)
    try {
      notify((await api('/users/verify-email/resend', { method: 'POST', body: { app: 'customer' } })).message, false, 4000)
    } catch (error) {
      notify(error.message, false, 4000)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="verify-banner" role="status">
      <div className="wrap verify-banner-inner">
        <Icon name="info" size={16} />
        <span>Confirm <b>{email}</b> to get order confirmations by email.</span>
        <button className="link" onClick={resend} disabled={sending}>{sending ? 'Sending…' : 'Resend link'}</button>
        <button className="verify-close" onClick={() => setHidden(true)} aria-label="Hide for now">×</button>
      </div>
    </div>
  )
}
