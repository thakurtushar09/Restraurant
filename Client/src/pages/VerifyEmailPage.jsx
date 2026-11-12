import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { api } from '../lib.js'

// Landing page for the link in the verification email.
export default function VerifyEmailPage({ signedIn, onVerified, navigate }) {
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
      .then((result) => { setState({ status: 'done', message: `${result.email} is confirmed. Order confirmations will arrive in this inbox.` }); onVerified() })
      .catch((error) => setState({ status: 'error', message: error.message }))
  }, [onVerified])

  return (
    <main className="wrap verify-page">
      <div className="verify-card">
        <span className={`verify-icon ${state.status}`}><Icon name={state.status === 'done' ? 'check' : state.status === 'error' ? 'alert' : 'clock'} size={22} /></span>
        <span className="eyebrow">Email</span>
        <h1>{state.status === 'checking' ? 'Confirming…' : state.status === 'done' ? 'You’re confirmed.' : 'That link didn’t work.'}</h1>
        <p className="hint">{state.status === 'checking' ? 'One moment.' : state.message}</p>
        {state.status !== 'checking' && (
          <button className="btn btn-primary" onClick={() => navigate(signedIn ? 'explore' : 'auth', signedIn ? '' : 'login')}>
            {signedIn ? 'Find something to eat' : 'Log in'} <Icon name="arrow" size={16} />
          </button>
        )}
      </div>
    </main>
  )
}
