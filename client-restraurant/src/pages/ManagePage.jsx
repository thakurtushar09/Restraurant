import Icon from '../components/Icon.jsx'
import MenuPage from './MenuPage.jsx'
import StaffPage from './StaffPage.jsx'
import BranchesPage from './BranchesPage.jsx'
import QrPage from './QrPage.jsx'
import { canManageMenu, canManageGroup } from '../lib.js'

const MANAGE_TABS = [
  { key: 'menu', label: 'Menu', icon: 'book', allowed: canManageMenu },
  { key: 'qr', label: 'QR code', icon: 'qr', allowed: canManageMenu },
  { key: 'team', label: 'Team', icon: 'users', allowed: canManageMenu },
  { key: 'branches', label: 'Branches', icon: 'store', allowed: canManageGroup },
]

export default function ManagePage({ tab, navigate, ...props }) {
  const tabs = MANAGE_TABS.filter((entry) => entry.allowed(props.role))
  const active = tabs.find((entry) => entry.key === tab) ?? tabs[0]

  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((entry) => (
          <button key={entry.key} role="tab" aria-selected={entry.key === active.key} className={entry.key === active.key ? 'active' : ''} onClick={() => navigate(`manage/${entry.key}`)}>
            <Icon name={entry.icon} size={16} />{entry.label}
          </button>
        ))}
      </div>
      {active.key === 'menu' && <MenuPage {...props} />}
      {active.key === 'qr' && <QrPage {...props} />}
      {active.key === 'team' && <StaffPage {...props} />}
      {active.key === 'branches' && <BranchesPage {...props} navigate={navigate} />}
    </>
  )
}
