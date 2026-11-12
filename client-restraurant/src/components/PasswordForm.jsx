import { useState } from 'react'
import { api, toast } from '../lib.js'

// Change password; used on the account page and for the first sign-in with a temporary password.
export default function PasswordForm({ currentLabel = 'Current password', submitLabel = 'Update password', onChanged }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (form.newPassword.length < 8) return setError('Use at least 8 characters for the new password.')
    if (form.newPassword !== form.confirm) return setError('The new passwords don’t match.')
    setSaving(true)
    try {
      const result = await api('/users/change-password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } })
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
      toast('Password updated')
      onChanged?.(result.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <label className="field">{currentLabel}<input type="password" value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" required /></label>
      <label className="field">New password<input type="password" value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" minLength={8} required /><small>At least 8 characters.</small></label>
      <label className="field">Confirm new password<input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
    </form>
  )
}
