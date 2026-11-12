import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import BranchForm from '../components/BranchForm.jsx'
import { api, toast, emptyBranchForm, branchFormToPayload, branchFormProblem, PHONE_PATTERN } from '../lib.js'

const EMPTY_BUSINESS = { groupName: '', legalName: '', businessEmail: '', businessPhone: '', taxNumber: '', websiteUrl: '', logoUrl: '' }

const STEPS = [
  { title: 'Your business', lede: 'The brand customers know you by, and how we reach you.' },
  { title: 'Your first branch', lede: 'Where orders are cooked and picked up. You can add more branches later.' },
  { title: 'How it runs', lede: 'Fulfillment options, timings and opening hours. You can change these any time.' },
]

export default function OnboardingPage({ user, hasRestaurants, onCreated, onCancel, onSignOut }) {
  const [step, setStep] = useState(0)
  const [business, setBusiness] = useState(EMPTY_BUSINESS)
  const [branch, setBranch] = useState(emptyBranchForm)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (key) => (event) => setBusiness((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const problem = branchFormProblem(branch)
    if (problem) {
      setError(problem)
      return
    }
    setSubmitting(true)
    try {
      const body = { ...business, ...branchFormToPayload(branch) }
      const result = await api('/restaurants', { method: 'POST', body })
      toast(`${result.data.group.groupName} is ready`)
      await onCreated(result.data.branch.id)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-inner">
        <div className="onboarding-head">
          <span className="wordmark">Name</span>
          {hasRestaurants
            ? <button className="btn btn-ghost btn-sm" onClick={onCancel}>Back to dashboard</button>
            : <button className="btn btn-ghost btn-sm" onClick={onSignOut}><Icon name="logout" size={15} /> Sign out</button>}
        </div>

        <div>
          <span className="eyebrow">Step {step + 1} of {STEPS.length}</span>
          <h1 style={{ marginTop: 10 }}>{step === 0 ? <>Welcome, {user.fullName.split(' ')[0]}. Let’s set up <em>your restaurant.</em></> : STEPS[step].title}</h1>
          <p className="lede">{STEPS[step].lede}</p>
        </div>
        <div className="steps">{STEPS.map((entry, index) => <span key={entry.title} className={index <= step ? 'done' : ''} />)}</div>

        <form className="card" onSubmit={submit}>
          {step === 0 && (
            <div className="form-grid">
              <span className="form-section-title">Brand</span>
              <label className="field span-2">Restaurant name<input value={business.groupName} onChange={set('groupName')} placeholder="e.g. Sunday Loaf" maxLength={100} required autoFocus /></label>
              <label className="field">Legal / registered name <small>optional</small><input value={business.legalName} onChange={set('legalName')} maxLength={150} /></label>
              <label className="field">GSTIN / tax number <small>optional</small><input value={business.taxNumber} onChange={set('taxNumber')} maxLength={30} /></label>
              <span className="form-section-title">Contact</span>
              <label className="field">Business email<input type="email" value={business.businessEmail} onChange={set('businessEmail')} placeholder="hello@restaurant.com" required /></label>
              <label className="field">Business phone<input type="tel" value={business.businessPhone} onChange={set('businessPhone')} pattern={PHONE_PATTERN} title="A valid phone number, digits with optional + and spaces" required /></label>
              <span className="form-section-title">Online presence</span>
              <label className="field">Website <small>optional</small><input type="url" value={business.websiteUrl} onChange={set('websiteUrl')} placeholder="https://" /></label>
              <label className="field">Logo URL <small>optional</small><input type="url" value={business.logoUrl} onChange={set('logoUrl')} placeholder="https://" /></label>
            </div>
          )}
          {step === 1 && <BranchForm value={branch} onChange={setBranch} sections={['contact', 'location']} />}
          {step === 2 && <>
            <BranchForm value={branch} onChange={setBranch} sections={['operations', 'hours']} />
            <div className="review" style={{ marginTop: 20 }}>
              <strong>{business.groupName} · {branch.branchName}</strong>
              <span>{[branch.addressLine1, branch.city, branch.state, branch.postalCode].filter(Boolean).join(', ')}</span>
              <span>{business.businessEmail} · {business.businessPhone}</span>
            </div>
          </>}

          {error && <p className="form-error" role="alert" style={{ marginTop: 16 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
            {step > 0 && <button type="button" className="btn btn-ghost" onClick={() => { setError(''); setStep(step - 1) }}>Back</button>}
            <button className="btn btn-primary" disabled={submitting}>
              {step < STEPS.length - 1 ? 'Continue' : submitting ? 'Creating…' : 'Create restaurant'} <Icon name="arrow" size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
