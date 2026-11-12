import { useEffect, useState } from 'react'
import { Drawer } from './Overlay.jsx'
import BranchForm from './BranchForm.jsx'
import { api, toast, emptyBranchForm, branchToForm, branchFormToPayload, branchFormProblem } from '../lib.js'

// Create a branch (no branchId) or edit an existing one (branchId given).
export default function BranchDrawer({ groupId, groupName, branchId, onClose, onSaved }) {
  const editing = Boolean(branchId)
  const [form, setForm] = useState(editing ? null : emptyBranchForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) return undefined
    const controller = new AbortController()
    api(`/restaurants/${groupId}/branches/${branchId}`, { signal: controller.signal })
      .then((result) => setForm(branchToForm(result.data)))
      .catch((err) => { if (err.name !== 'AbortError') setError(err.message) })
    return () => controller.abort()
  }, [editing, groupId, branchId])

  async function submit(event) {
    event.preventDefault()
    const problem = branchFormProblem(form)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = branchFormToPayload(form, { includeStatus: editing })
      const result = editing
        ? await api(`/restaurants/${groupId}/branches/${branchId}`, { method: 'PATCH', body })
        : await api(`/restaurants/${groupId}/branches`, { method: 'POST', body })
      toast(editing ? `${result.data.branchName} updated` : `${result.data.branchName} created`)
      await onSaved(result.data.id)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Drawer eyebrow={groupName} title={editing ? 'Edit branch' : 'New branch'} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="branch-form" disabled={saving || !form}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create branch'}</button>
      </>}>
      {form ? (
        <form id="branch-form" onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          <BranchForm value={form} onChange={setForm} showStatus={editing} />
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      ) : error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : (
        [0, 1, 2, 3, 4].map((key) => <div className="skeleton" key={key} style={{ height: 52 }} />)
      )}
    </Drawer>
  )
}
