import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import PasswordForm from '../components/PasswordForm.jsx'
import { api, toast, initials, ROLE_LABELS, PHONE_PATTERN } from '../lib.js'

const ROLE_SUMMARY = {
  GROUP_OWNER: 'Everything: orders, menus, branches and the whole team.',
  GROUP_ADMIN: 'Orders, menus, branches and the team, across every branch.',
  BRANCH_MANAGER: 'Orders, the menu and the kitchen and delivery team at this branch.',
  KITCHEN_STAFF: 'The kitchen screen: start cooking and mark dishes ready.',
  DELIVERY_STAFF: 'Deliveries: pick up packed orders and mark them delivered.',
}

export default function AccountPage({ user, workspaces, onUserChange, onSignOut }) {
  const [profile, setProfile] = useState({ fullName: user.fullName, phone: user.phone ?? '' })
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const changed = profile.fullName.trim() !== user.fullName || profile.phone.trim() !== (user.phone ?? '')

  async function saveProfile(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await api('/users/me', { method: 'PATCH', body: { fullName: profile.fullName, phone: profile.phone } })
      onUserChange(result.user)
      toast('Profile saved')
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function resend() {
    setSending(true)
    try {
      toast((await api('/users/verify-email/resend', { method: 'POST', body: { app: 'dashboard' } })).message)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="account-grid">
      <section className="card panel">
        <div className="account-id">
          <span className="avatar avatar-lg">{initials(user.fullName)}</span>
          <div><h2>{user.fullName}</h2><span className="muted">{user.email}</span></div>
        </div>

        <div className={`account-verify${user.isEmailVerified ? ' ok' : ''}`}>
          <Icon name={user.isEmailVerified ? 'shield' : 'mail'} size={16} />
          {user.isEmailVerified
            ? <span>Email confirmed</span>
            : <><span>Email not confirmed yet — check your inbox for the link.</span><button className="text-btn" onClick={resend} disabled={sending}>{sending ? 'Sending…' : 'Resend'}</button></>}
        </div>

        <form onSubmit={saveProfile} style={{ display: 'grid', gap: 14, marginTop: 20 }}>
          <label className="field">Full name<input value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} autoComplete="name" required maxLength={100} /></label>
          <label className="field">Phone<input type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} autoComplete="tel" pattern={PHONE_PATTERN} placeholder="+91 98765 43210" /></label>
          <label className="field">Email<input value={user.email} disabled /><small>Your email is your sign-in, so it can’t be changed here.</small></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={!changed || saving}>{saving ? 'Saving…' : 'Save profile'}</button>
            <span className="spacer" />
            <button type="button" className="btn btn-ghost" onClick={onSignOut}><Icon name="logout" size={15} /> Sign out</button>
          </div>
        </form>
      </section>

      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <section className="card panel">
          <div className="panel-head"><div><span className="eyebrow">Security</span><h2>Change password</h2></div><Icon name="key" /></div>
          <PasswordForm onChanged={onUserChange} />
        </section>

        <section className="card panel">
          <div className="panel-head"><div><span className="eyebrow">Access</span><h2>Where you work</h2></div></div>
          <ul className="access-list">
            {workspaces.map((entry) => (
              <li key={entry.branchId}>
                <div><strong>{entry.groupName} · {entry.branch.branchName}</strong><small>{ROLE_SUMMARY[entry.role]}</small></div>
                <span className={`chip${entry.role === 'GROUP_OWNER' ? ' chip-forest' : ''}`}>{ROLE_LABELS[entry.role]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
