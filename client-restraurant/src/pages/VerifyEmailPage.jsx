import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { api } from '../lib.js'

// Landing page for the link in the verification email.
export default function VerifyEmailPage({ signedIn, onVerified, onContinue }) {
  const [state, setState] = useState({ status: 'checking', message: '' })
  const started = useRef(false)

  useEffect(() => {
    // StrictMode mounts twice in development; only send the token once.
    if (started.current) return
    started.current = true
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      Promise.resolve().then(() => setState({ status: 'error', message: 'This link is missing its code. Open the newest email we sent you.' }))
      return
    }
    api('/users/verify-email', { method: 'POST', body: { token } })
      .then((result) => { setState({ status: 'done', message: `${result.email} is confirmed.` }); onVerified?.() })
      .catch((error) => setState({ status: 'error', message: error.message }))
  }, [onVerified])

  return (
    <div className="onboarding">
      <div className="verify-card card">
        <span className={`empty-icon${state.status === 'error' ? ' danger' : ''}`}>
          <Icon name={state.status === 'done' ? 'check' : state.status === 'error' ? 'alert' : 'mail'} />
        </span>
        <h1>{state.status === 'checking' ? 'Confirming your email…' : state.status === 'done' ? 'Email confirmed' : 'We couldn’t confirm it'}</h1>
        <p>{state.status === 'checking' ? 'One moment.' : state.message}</p>
        {state.status !== 'checking' && (
          <button className="btn btn-primary" onClick={onContinue}>{signedIn ? 'Go to dashboard' : 'Sign in'} <Icon name="arrow" size={16} /></button>
        )}
      </div>
    </div>
  )
}
