import Icon from '../components/Icon.jsx'
import { canManageMenu, BRANCH_STATUS_LABELS } from '../lib.js'

// Customer-facing app (Client/) runs on Vite's default port in development.
const CUSTOMER_SITE = 'http://localhost:5173'

export default function BranchesPage({ workspace, workspaces, role, onSelect, onEditBranch, navigate }) {
  const branches = workspaces.filter((entry) => entry.groupId === workspace.groupId).map((entry) => entry.branch)

  return (
    <>
      <div className="toolbar">
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{branches.length} {branches.length === 1 ? 'branch' : 'branches'} in {workspace.groupName}</span>
        <span className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('onboarding')}><Icon name="store" size={15} /> New restaurant</button>
      </div>
      <div className="branch-grid">
        {branches.map((branch) => {
          const current = branch.id === workspace.branchId
          return (
            <article className={`card branch-card${current ? ' current' : ''}`} key={branch.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`chip chip-dot${branch.status === 'ACTIVE' ? '' : ' chip-muted'}`}>{BRANCH_STATUS_LABELS[branch.status] ?? branch.status}</span>
                {current && <span className="chip chip-forest">Current</span>}
              </div>
              <h3>{branch.branchName}</h3>
              <span className="meta"><Icon name="pin" size={14} />{branch.city}</span>
              <span className="meta"><Icon name="clock" size={14} />{branch.averagePreparationTimeMinutes} min average prep</span>
              <div className="row">
                {branch.acceptsDineIn && <span className="chip">Pre-order</span>}
                {branch.acceptsDelivery && <span className="chip">Delivery</span>}
              </div>
              <div className="actions">
                {!current && <button className="btn btn-primary btn-sm" onClick={() => { onSelect(branch.id); navigate('overview') }}>Switch to branch</button>}
                {canManageMenu(role) && <button className="btn btn-ghost btn-sm" onClick={() => onEditBranch(branch.id)}><Icon name="edit" size={14} /> Edit</button>}
                <a className="btn btn-ghost btn-sm" href={`${CUSTOMER_SITE}/restaurant/${encodeURIComponent(branch.publicSlug)}`} target="_blank" rel="noreferrer">Customer page ↗</a>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
