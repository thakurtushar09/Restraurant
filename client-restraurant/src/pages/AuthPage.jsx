import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { api } from '../lib.js'

export default function AuthPage({ mode, onSwitch, onAuthenticated }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isSignup = mode === 'signup'

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (isSignup && form.password.length < 8) {
      setError('Choose a password with at least 8 characters.')
      return
    }
    setSubmitting(true)
    try {
      const body = isSignup ? { ...form, app: 'dashboard' } : { email: form.email, password: form.password }
      const result = await api(`/users/${mode}`, { method: 'POST', body })
      await onAuthenticated(result.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <section className="auth-visual">
        <span className="wordmark">CraveQ</span>
        <div>
          <span className="eyebrow" style={{ color: 'var(--sage)' }}>Restaurant dashboard</span>
          <h1 style={{ marginTop: 16 }}>Run a calmer<br /><em>service.</em></h1>
          <p>Every order, dish and teammate in one place — from the first ticket to the last delivery.</p>
          <div className="auth-features">
            <span><Icon name="receipt" /> Live order board that updates on its own</span>
            <span><Icon name="book" /> Menus, variants and availability in seconds</span>
            <span><Icon name="users" /> Roles for managers, kitchen and delivery</span>
          </div>
        </div>
        <span className="auth-foot">Orders, menus and teams in one place.</span>
      </section>

      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <span className="eyebrow">{isSignup ? 'Open your kitchen' : 'Welcome back'}</span>
          <h2>{isSignup ? 'Create your account.' : 'Sign in to your desk.'}</h2>
          <p className="lede">{isSignup ? 'You’ll set up your restaurant right after this.' : 'Use the same account your restaurant added you with.'}</p>
          {isSignup && <label className="field">Full name<input value={form.fullName} onChange={set('fullName')} autoComplete="name" required /></label>}
          <label className="field">Email<input type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></label>
          <label className="field">Password{!isSignup && <button type="button" className="text-btn" style={{ justifySelf: 'end' }} onClick={() => onSwitch('forgot-password')}>Forgot password?</button>}<input type="password" value={form.password} onChange={set('password')} autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={isSignup ? 8 : 1} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" style={{ minHeight: 48 }} disabled={submitting}>
            {submitting ? 'One moment…' : isSignup ? 'Create account' : 'Sign in'} <Icon name="arrow" size={16} />
          </button>
          <p className="auth-switch">
            {isSignup ? 'Already have an account?' : 'New restaurant?'}{' '}
            <button type="button" onClick={() => onSwitch(isSignup ? 'login' : 'signup')}>{isSignup ? 'Sign in' : 'Create an account'}</button>
          </p>
        </form>
      </section>
    </div>
  )
}
