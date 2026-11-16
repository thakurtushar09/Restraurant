import Icon from '../components/Icon.jsx'
import PasswordForm from '../components/PasswordForm.jsx'

// First sign-in for teammates added by a manager: swap the emailed password for their own.
export default function SetPasswordPage({ user, onChanged, onSignOut }) {
  return (
    <div className="auth">
      <section className="auth-visual">
        <span className="wordmark"><img src="/logo-light.svg" alt="CraveQ" /></span>
        <div>
          <span className="eyebrow" style={{ color: 'var(--sage)' }}>Welcome, {user.fullName.split(' ')[0]}</span>
          <h1 style={{ marginTop: 16 }}>Make this<br /><em>account yours.</em></h1>
          <p>You signed in with a temporary password from your invite email. Choose one only you know before you continue.</p>
          <div className="auth-features">
            <span><Icon name="shield" /> Your manager never sees your new password</span>
            <span><Icon name="mail" /> We’ll email you whenever it changes</span>
          </div>
        </div>
        <span className="auth-foot">Signed in as {user.email}</span>
      </section>

      <section className="auth-panel">
        <div className="auth-form">
          <span className="eyebrow">One last step</span>
          <h2>Choose your password.</h2>
          <p className="lede">Enter the temporary password from your email, then your new one.</p>
          <PasswordForm currentLabel="Temporary password" submitLabel="Save and continue" onChanged={onChanged} />
          <p className="auth-switch">Not you? <button type="button" onClick={onSignOut}>Sign out</button></p>
        </div>
      </section>
    </div>
  )
}
