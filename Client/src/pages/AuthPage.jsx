import { useState } from 'react'
import Icon from '../components/Icon.jsx'

export default function AuthPage({ mode, onSwitch, onBack, onForgot, onAuthenticated }) {
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
      const response = await fetch(`/api/v1/users/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSignup ? form : { email: form.email, password: form.password }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.message || 'We could not sign you in')
      setForm((current) => ({ ...current, password: '' }))
      onAuthenticated(result.user)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth">
      <section className="auth-visual">
        <div className="auth-photo" aria-hidden="true" />
        <div className="auth-card" aria-hidden="true">
          <span className="ic"><Icon name="calendar" size={18} /></span>
          <span><strong>Table for 2 · 7:30 PM</strong><small>Food ready as you sit down</small></span>
        </div>
        <span className="band-pill">{isSignup ? 'Your table is waiting' : 'Welcome back'}</span>
        <h1 style={{ marginTop: 16 }}><span>Skip the wait, <em>keep the meal.</em></span></h1>
        <p>Pre-order from local kitchens and walk in to food that’s ready when you are.</p>
      </section>
      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <button type="button" className="back" style={{ margin: '0 0 8px' }} onClick={onBack}><Icon name="back" size={16} /> Back</button>
          <span className="eyebrow">{isSignup ? 'Your table is waiting' : 'Welcome back'}</span>
          <h2>{isSignup ? 'Make yourself at home.' : 'Good to see you again.'}</h2>
          <p className="lede">{isSignup ? 'Create an account to save your details and make checkout easier.' : 'Sign in to continue with your account and saved details.'}</p>
          {isSignup && <label className="field">Your name<input value={form.fullName} onChange={set('fullName')} autoComplete="name" placeholder="How should we call you?" required /></label>}
          <label className="field">Email address<input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" required /></label>
          {!isSignup && <button type="button" className="link forgot-link" onClick={onForgot}>Forgot password?</button>}
          <label className="field">Password<input type="password" value={form.password} onChange={set('password')} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'} minLength={isSignup ? 8 : 1} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" style={{ minHeight: 50 }} disabled={submitting}>
            {submitting ? 'One moment…' : isSignup ? 'Create your account' : 'Log in'} <Icon name="arrow" size={16} />
          </button>
          <p className="auth-switch">
            {isSignup ? 'Already have an account?' : 'New around here?'}{' '}
            <button type="button" onClick={() => onSwitch(isSignup ? 'login' : 'signup')}>{isSignup ? 'Log in' : 'Create an account'}</button>
          </p>
          <div className="guest-note"><Icon name="bag" size={17} /><span>You can browse and fill your cart without signing in. Sign in is only needed at checkout.</span></div>
        </form>
      </section>
    </main>
  )
}
