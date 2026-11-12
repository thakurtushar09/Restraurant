import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Modal } from '../components/Overlay.jsx'
import { api, toast, initials, copyText, generatePassword, assignableRoles, ROLE_LABELS, BRANCH_ROLES } from '../lib.js'

function AddMemberModal({ groupId, branches, roles, canAddAdmins, lockedBranch, defaultBranchId, onClose, onAdded }) {
  const [form, setForm] = useState(() => ({ fullName: '', email: '', password: generatePassword(), role: 'KITCHEN_STAFF', branchId: defaultBranchId }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const needsBranch = BRANCH_ROLES.includes(form.role)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    if (form.password.length < 8) return setError('The password needs at least 8 characters.')
    setSaving(true)
    setError('')
    try {
      const response = await api(`/restaurants/${groupId}/members`, {
        method: 'POST',
        body: {
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          password: form.password,
          role: form.role,
          ...(needsBranch ? { branchId: lockedBranch?.id ?? form.branchId } : {}),
        },
      })
      setResult(response)
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    const member = result.data
    return (
      <Modal title={result.emailSent ? 'Invite sent' : 'Teammate added'} onClose={onClose}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className={`invite-status${result.emailSent ? ' ok' : ''}`}>
            <Icon name={result.emailSent ? 'mail' : 'alert'} size={18} />
            <span>
              {result.emailSent
                ? result.accountCreated
                  ? <>We emailed <b>{member.user.email}</b> their sign-in details. They’ll choose their own password the first time they sign in.</>
                  : <><b>{member.user.fullName}</b> already had an account, so we kept their password and emailed them that they now have access.</>
                : <>The email couldn’t be sent{result.emailError ? ` (${result.emailError})` : ''}. {result.accountCreated ? 'Share these sign-in details with them yourself:' : 'They can sign in with their existing password.'}</>}
            </span>
          </div>
          {!result.emailSent && result.accountCreated && <Credentials email={member.user.email} password={form.password} />}
          <div className="modal-actions"><button className="btn btn-primary" onClick={onClose}>Done</button></div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Add a teammate" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>We’ll create their account and email them the sign-in details. If they already have an account, they just get access.</p>
        <label className="field">Full name<input value={form.fullName} onChange={set('fullName')} autoComplete="off" required autoFocus /></label>
        <label className="field">Email<input type="email" value={form.email} onChange={set('email')} autoComplete="off" required /></label>
        <label className="field">Temporary password
          <div className="input-row">
            <input value={form.password} onChange={set('password')} autoComplete="new-password" minLength={8} required spellCheck={false} className="mono" />
            <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, password: generatePassword() })} title="Generate a new password"><Icon name="refresh" size={15} /></button>
          </div>
          <small>Sent in the invite email. They must change it after signing in.</small>
        </label>
        <div className="form-grid" style={{ gap: 14 }}>
          <label className="field">Role
            <select value={form.role} onChange={set('role')}>
              {roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              {canAddAdmins && <option value="GROUP_ADMIN">{ROLE_LABELS.GROUP_ADMIN} (all branches)</option>}
            </select>
          </label>
          {needsBranch && (
            <label className="field">Branch
              {lockedBranch
                ? <input value={lockedBranch.branchName} disabled />
                : <select value={form.branchId} onChange={set('branchId')}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}</select>}
            </label>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : <><Icon name="mail" size={15} /> Add and email</>}</button>
        </div>
      </form>
    </Modal>
  )
}

function Credentials({ email, password }) {
  return (
    <div className="credentials">
      <div><small>Sign in at</small><span className="mono">{window.location.origin}/login</span></div>
      <div><small>Email</small><span className="mono">{email}</span></div>
      <div><small>Password</small><span className="mono">{password}</span></div>
      <button className="btn btn-ghost btn-sm" onClick={() => copyText(`Sign in at ${window.location.origin}/login\nEmail: ${email}\nTemporary password: ${password}`)}><Icon name="copy" size={14} /> Copy</button>
    </div>
  )
}

export default function StaffPage({ workspace, role, user, workspaces }) {
  const groupId = workspace.groupId
  const branches = workspaces.filter((entry) => entry.groupId === groupId).map((entry) => entry.branch)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [filter, setFilter] = useState('all')
  const [reinvite, setReinvite] = useState(null)
  const isOwner = role === 'GROUP_OWNER'
  // Branch managers see and manage only their branch's kitchen and delivery staff.
  const isBranchManager = role === 'BRANCH_MANAGER'
  const roles = assignableRoles(role)

  const load = useCallback(async () => {
    try {
      const result = await api(`/restaurants/${groupId}/members`)
      setMembers(result.data)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => { Promise.resolve().then(load) }, [load])

  async function update(member, body, message) {
    try {
      const result = await api(`/restaurants/${groupId}/members/${member.id}`, { method: 'PATCH', body })
      setMembers((current) => body.status === 'REMOVED'
        ? current.filter((entry) => entry.id !== member.id)
        : current.map((entry) => entry.id === member.id ? result.data : entry))
      toast(message)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function resendInvite(member) {
    try {
      const result = await api(`/restaurants/${groupId}/members/${member.id}/resend-invite`, { method: 'POST', body: {} })
      if (result.emailSent) toast(result.message)
      else setReinvite({ member, password: result.password, error: result.emailError })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const editable = (member) => member.role !== 'GROUP_OWNER' && member.user.id !== user.id &&
    (isBranchManager ? roles.includes(member.role) : isOwner || member.role !== 'GROUP_ADMIN')
  const visible = members.filter((member) => filter === 'all' || member.branchId === workspace.branchId || member.branchId === null)

  return (
    <>
      <div className="toolbar">
        {isBranchManager ? <span className="muted">Your team at {workspace.branch.branchName}</span> : (
          <div className="segmented">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Everyone<span className="count">{members.length}</span></button>
            <button className={filter === 'branch' ? 'active' : ''} onClick={() => setFilter('branch')}>{workspace.branch.branchName}</button>
          </div>
        )}
        <span className="spacer" />
        <button className="btn btn-accent" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add teammate</button>
      </div>

      {error ? (
        <div className="card empty"><span className="empty-icon"><Icon name="alert" /></span><h3>Couldn’t load your team</h3><p>{error}</p><button className="btn btn-primary" onClick={load}>Try again</button></div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Person</th><th>Role</th><th>Branch</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {loading ? [0, 1, 2].map((key) => <tr key={key}><td colSpan={5}><div className="skeleton" style={{ height: 34 }} /></td></tr>) : visible.map((member) => {
                const canEdit = editable(member)
                return (
                  <tr key={member.id}>
                    <td><div className="person"><span className="avatar">{initials(member.user.fullName)}</span><div><strong>{member.user.fullName}{member.user.id === user.id && ' (you)'}</strong><small>{member.user.email}</small></div></div></td>
                    <td>
                      {canEdit ? (
                        <select value={member.role} aria-label="Role" onChange={(event) => {
                          const nextRole = event.target.value
                          const body = { role: nextRole }
                          if (BRANCH_ROLES.includes(nextRole) && !member.branchId) body.branchId = workspace.branchId
                          update(member, body, `${member.user.fullName} is now ${ROLE_LABELS[nextRole].toLowerCase()}`)
                        }}>
                          {roles.map((entry) => <option key={entry} value={entry}>{ROLE_LABELS[entry]}</option>)}
                          {isOwner && <option value="GROUP_ADMIN">{ROLE_LABELS.GROUP_ADMIN}</option>}
                        </select>
                      ) : <span className={`chip${member.role === 'GROUP_OWNER' ? ' chip-forest' : ''}`}>{ROLE_LABELS[member.role]}</span>}
                    </td>
                    <td>
                      {member.branchId === null ? <span style={{ color: 'var(--muted)' }}>All branches</span> : canEdit && !isBranchManager ? (
                        <select value={member.branchId} aria-label="Branch" onChange={(event) => update(member, { branchId: event.target.value }, 'Branch updated')}>
                          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.branchName}</option>)}
                        </select>
                      ) : member.branch?.branchName}
                    </td>
                    <td>
                      <div className="status-stack">
                        {member.user.mustChangePassword
                          ? <span className="chip chip-dot chip-accent" title="Hasn’t signed in and set their own password yet">invite pending</span>
                          : <span className={`chip chip-dot${member.status === 'ACTIVE' ? '' : ' chip-muted'}`}>{member.status.toLowerCase()}</span>}
                        {!member.user.isEmailVerified && <span className="chip chip-muted" title="Hasn’t clicked the link in their email yet">email unconfirmed</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canEdit && <>
                        {member.user.mustChangePassword && <><button className="btn btn-ghost btn-sm" onClick={() => resendInvite(member)} title="Email a new temporary password"><Icon name="mail" size={14} /> Resend invite</button>{' '}</>}
                        <button className="btn btn-ghost btn-sm" onClick={() => update(member, { status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }, member.status === 'ACTIVE' ? 'Access paused' : 'Access restored')}>
                          {member.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </button>{' '}
                        <button className="icon-btn" aria-label={`Remove ${member.user.fullName}`} onClick={() => setRemoving(member)}><Icon name="trash" size={16} /></button>
                      </>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && <AddMemberModal groupId={groupId} branches={branches} roles={roles} canAddAdmins={isOwner} lockedBranch={isBranchManager ? workspace.branch : null} defaultBranchId={workspace.branchId} onClose={() => setAdding(false)} onAdded={load} />}
      {reinvite && (
        <Modal title="New password created" onClose={() => setReinvite(null)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="invite-status"><Icon name="alert" size={18} /><span>The email to {reinvite.member.user.email} couldn’t be sent{reinvite.error ? ` (${reinvite.error})` : ''}. Share these details with {reinvite.member.user.fullName.split(' ')[0]} yourself:</span></div>
            <Credentials email={reinvite.member.user.email} password={reinvite.password} />
            <div className="modal-actions"><button className="btn btn-primary" onClick={() => setReinvite(null)}>Done</button></div>
          </div>
        </Modal>
      )}
      {removing && (
        <Modal title={`Remove ${removing.user.fullName}?`} onClose={() => setRemoving(null)}>
          <p style={{ color: 'var(--muted)' }}>They’ll lose access to this restaurant straight away. You can add them again later.</p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setRemoving(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => { update(removing, { status: 'REMOVED' }, `${removing.user.fullName} removed`); setRemoving(null) }}>Remove</button>
          </div>
        </Modal>
      )}
    </>
  )
}
