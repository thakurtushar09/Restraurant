import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { api } from '../lib.js'

function Shell({ children }) {
  return (
    <div className="auth">
      <section className="auth-visual">
        <span className="wordmark"><img src="/logo-light.svg" alt="CraveQ" /></span>
        <div>
          <span className="eyebrow" style={{ color: 'var(--sage)' }}>Account recovery</span>
          <h1 style={{ marginTop: 16 }}>Back to service<br /><em>in a minute.</em></h1>
          <p>We’ll email you a link to choose a new password. It works once and expires after an hour.</p>
          <div className="auth-features">
            <span><Icon name="shield" /> Every other device is signed out after a reset</span>
            <span><Icon name="mail" /> We’ll email you when your password changes</span>
          </div>
        </div>
        <span className="auth-foot">Orders, menus and teams in one place.</span>
      </section>
      <section className="auth-panel">{children}</section>
    </div>
  )
}

export function ForgotPasswordPage({ onBack }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setSent((await api('/users/forgot-password', { method: 'POST', body: { email: email.trim(), app: 'dashboard' } })).message)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Shell>
      <form className="auth-form" onSubmit={submit}>
        <span className="eyebrow">Forgot password</span>
        <h2>{sent ? 'Check your inbox.' : 'Reset your password.'}</h2>
        {sent ? (
          <p className="lede">{sent} Don’t see it? Look in spam, or try again in a few minutes.</p>
        ) : (
          <>
            <p className="lede">Enter the email you sign in with and we’ll send you a reset link.</p>
            <label className="field">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required autoFocus /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" style={{ minHeight: 48 }} disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'} <Icon name="arrow" size={16} /></button>
          </>
        )}
        <p className="auth-switch">Remembered it? <button type="button" onClick={onBack}>Back to sign in</button></p>
      </form>
    </Shell>
  )
}

export function ResetPasswordPage({ onDone, onForgot }) {
  const [form, setForm] = useState({ newPassword: '', confirm: '' })
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const token = new URLSearchParams(window.location.search).get('token')

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (form.newPassword.length < 8) return setError('Use at least 8 characters.')
    if (form.newPassword !== form.confirm) return setError('The passwords don’t match.')
    setSubmitting(true)
    try {
      const result = await api('/users/reset-password', { method: 'POST', body: { token, newPassword: form.newPassword } })
      await onDone(result.user)
    } catch (err) {
      setError(err.message)
      if (err.status === 400 && /link/i.test(err.message)) setExpired(true)
      setSubmitting(false)
    }
  }

  if (!token || expired) {
    return (
      <Shell>
        <div className="auth-form">
          <span className="eyebrow">Reset password</span>
          <h2>This link has expired.</h2>
          <p className="lede">{error || 'This reset link is incomplete.'} Reset links work once and only for an hour.</p>
          <button className="btn btn-primary btn-block" style={{ minHeight: 48 }} onClick={onForgot}>Send a new link <Icon name="arrow" size={16} /></button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <form className="auth-form" onSubmit={submit}>
        <span className="eyebrow">Reset password</span>
        <h2>Choose a new password.</h2>
        <p className="lede">You’ll be signed in here and signed out everywhere else.</p>
        <label className="field">New password<input type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} autoComplete="new-password" minLength={8} required autoFocus /></label>
        <label className="field">Confirm new password<input type="password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} autoComplete="new-password" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" style={{ minHeight: 48 }} disabled={submitting}>{submitting ? 'Saving…' : 'Save and sign in'} <Icon name="arrow" size={16} /></button>
      </form>
    </Shell>
  )
}
