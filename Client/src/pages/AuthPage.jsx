import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import AuthLayout from '../components/AuthLayout.jsx'

const EMAIL_KEY = 'craveq:last-email'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const STRENGTH = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

const PERKS = [
  { icon: 'clock', text: 'Skip the queue — food lands as you sit down' },
  { icon: 'calendar', text: 'Pick a time slot that suits you' },
  { icon: 'bell', text: 'Get a ping the moment your order’s ready' },
]

function savedEmail() {
  try { return window.localStorage.getItem(EMAIL_KEY) || '' } catch { return '' }
}

// 0 until the minimum length is met, then 1–4: one more point each for length, mixed case, digits and symbols.
function passwordScore(password) {
  if (password.length < 8) return 0
  const checks = [password.length >= 12, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)]
  return Math.min(4, 1 + checks.filter(Boolean).length)
}

export default function AuthPage({ mode, onSwitch, onBack, onForgot, onAuthenticated }) {
  const [form, setForm] = useState(() => ({ fullName: '', email: savedEmail(), password: '' }))
  const [emailTouched, setEmailTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const firstField = useRef(null)
  const isSignup = mode === 'signup'
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const emailValid = EMAIL_PATTERN.test(form.email.trim())
  const emailInvalid = emailTouched && form.email !== '' && !emailValid
  const score = passwordScore(form.password)

  const firstRender = useRef(true)

  // Switching between log in and sign up keeps what was typed, but starts fresh on errors.
  // Focus only follows a switch — focusing on load would pop the keyboard open on phones.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setError('')
    firstField.current?.focus({ preventScroll: true })
  }, [mode])

  function fail(message) {
    setError(message)
    setShake((count) => count + 1)
  }

  function trackCapsLock(event) {
    if (event.getModifierState) setCapsLock(event.getModifierState('CapsLock'))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setEmailTouched(true)
    if (!emailValid) return fail('That email doesn’t look quite right.')
    if (isSignup && form.password.length < 8) return fail('Choose a password with at least 8 characters.')
    setSubmitting(true)
    try {
      const email = form.email.trim()
      const response = await fetch(`/api/v1/users/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSignup ? { ...form, email, app: 'customer' } : { email, password: form.password, app: 'customer' }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.message || 'We could not sign you in')
      try { window.localStorage.setItem(EMAIL_KEY, email) } catch { /* storage unavailable */ }
      setForm((current) => ({ ...current, password: '' }))
      onAuthenticated(result.user)
    } catch (err) {
      fail(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const extra = (
    <>
      <ul className="auth-perks">
        {PERKS.map((perk) => <li key={perk.icon}><span className="ic"><Icon name={perk.icon} size={16} /></span>{perk.text}</li>)}
      </ul>
      <div className="auth-ticket" aria-hidden="true">
        <span className="ic"><Icon name="check" size={16} /></span>
        <span><strong>Your order is ready</strong><small>Table 4 · served in 2 min</small></span>
      </div>
    </>
  )

  return (
    <AuthLayout
      eyebrow={isSignup ? 'Your table is waiting' : 'Welcome back'}
      title={isSignup ? <>Skip the wait, <em>keep the meal.</em></> : <>Good days are made <em>around the table.</em></>}
      lede={isSignup ? 'Create an account and walk in to food that’s ready when you are.' : 'Log in and pick up right where you left off.'}
      extra={extra}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className={`auth-tabs${isSignup ? ' is-signup' : ''}`} role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={!isSignup} onClick={() => isSignup && onSwitch('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={isSignup} onClick={() => !isSignup && onSwitch('signup')}>Sign up</button>
        </div>

        <div className="auth-head">
          <h2>{isSignup ? 'Create your account' : 'Log in to your account'}</h2>
          <p className="lede">{isSignup ? 'It takes less than a minute. Promise.' : 'Your saved details are right where you left them.'}</p>
        </div>

        {isSignup && (
          <label className="field">Your name
            <div className="control"><Icon name="user" size={17} /><input ref={firstField} value={form.fullName} onChange={set('fullName')} autoComplete="name" placeholder="How should we call you?" required /></div>
          </label>
        )}

        <label className="field">Email address
          <div className={`control${emailInvalid ? ' invalid' : ''}`}>
            <Icon name="mail" size={17} />
            <input ref={isSignup ? undefined : firstField} type="email" inputMode="email" value={form.email} onChange={set('email')} onBlur={() => setEmailTouched(true)} autoComplete="email" placeholder="you@example.com" aria-invalid={emailInvalid} required />
            {emailValid && <span className="valid-mark"><Icon name="check" size={14} /></span>}
          </div>
          {emailInvalid && <small className="form-hint error">Check for a typo — it should look like name@example.com</small>}
        </label>

        <div className="password-field">
          <label className="field">Password
            <div className="control">
              <Icon name="lock" size={17} />
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} onKeyDown={trackCapsLock} onKeyUp={trackCapsLock} onBlur={() => setCapsLock(false)} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'} required />
              <button type="button" className="reveal-btn" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={17} /></button>
            </div>
          </label>
          {capsLock && <small className="caps-hint"><Icon name="alert" size={14} /> Caps Lock is on</small>}
          {isSignup && form.password && (
            <div className={`strength s${score}`} aria-live="polite">
              <span className="bars" aria-hidden="true"><i /><i /><i /><i /></span>
              <small>{STRENGTH[score]}{score > 0 && score < 3 && ' — add a number or symbol'}</small>
            </div>
          )}
          {!isSignup && <button type="button" className="link forgot-link" onClick={onForgot}>Forgot your password?</button>}
        </div>

        {error && <p key={shake} className="form-error shake" role="alert"><Icon name="alert" size={16} /> {error}</p>}

        <button className="btn btn-primary btn-block auth-submit" disabled={submitting}>
          {submitting ? <><span className="spinner" aria-hidden="true" /> {isSignup ? 'Creating your account…' : 'Logging you in…'}</> : <>{isSignup ? 'Create account' : 'Log in'} <Icon name="arrow" size={16} /></>}
        </button>

        <div className="or" aria-hidden="true">or</div>
        <button type="button" className="btn btn-ghost btn-block auth-guest" onClick={onBack}>
          <Icon name="bag" size={17} /> Continue as guest
        </button>
        <p className="auth-fine">Guests can browse and fill a cart — you’ll only need an account at checkout.</p>
      </form>
    </AuthLayout>
  )
}
