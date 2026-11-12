import { useMemo, useState } from 'react'
import { buildSlotDays } from '../lib.js'

// Day tabs + time grid for a branch's bookable slots. `value` is an ISO string or ''.
export default function SlotPicker({ branch, value, onChange }) {
  const days = useMemo(() => buildSlotDays(branch), [branch])
  const initialDay = days.find((day) => day.slots.some((slot) => slot.iso === value))?.key ?? days[0]?.key
  const [dayKey, setDayKey] = useState(initialDay)
  const active = days.find((day) => day.key === dayKey) ?? days[0]

  if (!days.length) {
    return <p className="hint">This restaurant has no open times in the next week.</p>
  }

  return (
    <div className="slot-picker">
      <div className="day-tabs" role="tablist" aria-label="Day">
        {days.map((day) => (
          <button type="button" role="tab" aria-selected={day.key === active.key} key={day.key} className={day.key === active.key ? 'active' : ''} onClick={() => setDayKey(day.key)}>
            {day.label}
          </button>
        ))}
      </div>
      <div className="slots" role="listbox" aria-label={`Times on ${active.label}`}>
        {active.slots.map((slot) => (
          <button type="button" role="option" aria-selected={slot.iso === value} key={slot.iso} className={slot.iso === value ? 'active' : ''} onClick={() => onChange(slot.iso)}>
            {slot.label}
          </button>
        ))}
      </div>
    </div>
  )
}
