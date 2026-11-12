import { useState } from 'react'
import Icon from './Icon.jsx'
import { api, toast } from '../lib.js'

// Reminder until the signed-in person confirms their email address.
export default function VerifyBanner({ email }) {
  const [sending, setSending] = useState(false)
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  async function resend() {
    setSending(true)
    try {
      const result = await api('/users/verify-email/resend', { method: 'POST', body: { app: 'dashboard' } })
      toast(result.message)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="verify-banner" role="status">
      <Icon name="mail" size={16} />
      <span>Confirm <b>{email}</b> using the link we emailed you.</span>
      <button className="text-btn" onClick={resend} disabled={sending}>{sending ? 'Sending…' : 'Resend link'}</button>
      <button className="icon-btn" onClick={() => setHidden(true)} aria-label="Hide for now"><Icon name="close" size={15} /></button>
    </div>
  )
}
