import { STATUS_META } from '../lib.js'

export default function StatusChip({ status }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#788278' }
  return (
    <span className="chip chip-dot" style={{ color: meta.color, background: `${meta.color}1f` }}>
      {meta.label}
    </span>
  )
}
