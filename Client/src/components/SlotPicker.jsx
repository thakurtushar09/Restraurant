import { useMemo, useState } from 'react'
import { buildSlotDays, checkCustomTime, formatInZone, zonedDayAndMinutes } from '../lib.js'
import ClockPicker from './ClockPicker.jsx'
import Icon from './Icon.jsx'

// Day tabs, then either the quick 15-minute grid or a clock for any exact time. `value` is an ISO string or ''.
export default function SlotPicker({ branch, value, onChange }) {
  const days = useMemo(() => buildSlotDays(branch), [branch])
  const picked = value ? zonedDayAndMinutes(value, branch.timezone) : null
  const onGrid = days.some((day) => day.slots.some((slot) => slot.iso === value))
  const [dayKey, setDayKey] = useState(() => (days.some((day) => day.key === picked?.key) ? picked.key : days[0]?.key))
  const [tab, setTab] = useState(value && !onGrid ? 'custom' : 'quick')
  const [customMinutes, setCustomMinutes] = useState(() => picked?.minutes ?? null)
  const active = days.find((day) => day.key === dayKey) ?? days[0]

  if (!days.length) {
    return <p className="hint">This restaurant has no open times in the next week.</p>
  }

  // Default the clock to the day's first bookable time.
  const firstMinutes = (day) => zonedDayAndMinutes(day.slots[0].iso, branch.timezone).minutes
  const clockMinutes = customMinutes ?? firstMinutes(active)
  const check = checkCustomTime(branch, active, clockMinutes)
  const dayName = ['Today', 'Tomorrow'].includes(active.label) ? active.label.toLowerCase() : `on ${active.label}`

  function pickCustom(day, minutes) {
    setCustomMinutes(minutes)
    onChange(checkCustomTime(branch, day, minutes).iso ?? '')
  }

  function pickDay(day) {
    setDayKey(day.key)
    if (tab === 'custom') pickCustom(day, customMinutes ?? firstMinutes(day))
  }

  function pickTab(next) {
    setTab(next)
    if (next === 'custom') pickCustom(active, clockMinutes)
    else if (!onGrid) onChange('')
  }

  return (
    <div className="slot-picker">
      <div className="day-tabs" role="tablist" aria-label="Day">
        {days.map((day) => (
          <button type="button" role="tab" aria-selected={day.key === active.key} key={day.key} className={day.key === active.key ? 'active' : ''} onClick={() => pickDay(day)}>
            {day.label}
          </button>
        ))}
      </div>

      <div className={`slot-modes${tab === 'custom' ? ' is-custom' : ''}`} role="tablist" aria-label="How to pick a time">
        <button type="button" role="tab" aria-selected={tab === 'quick'} onClick={() => pickTab('quick')}><Icon name="calendar" size={15} /> Quick picks</button>
        <button type="button" role="tab" aria-selected={tab === 'custom'} onClick={() => pickTab('custom')}><Icon name="clock" size={15} /> Custom time</button>
      </div>

      {tab === 'quick' ? (
        <div className="slots" role="listbox" aria-label={`Times on ${active.label}`}>
          {active.slots.map((slot) => (
            <button type="button" role="option" aria-selected={slot.iso === value} key={slot.iso} className={slot.iso === value ? 'active' : ''} onClick={() => onChange(slot.iso)}>
              {slot.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="custom-time">
          <ClockPicker minutes={clockMinutes} onChange={(minutes) => pickCustom(active, minutes)} />
          <div className={`custom-status${check.error ? ' error' : ''}`} role="status">
            <Icon name={check.error ? 'alert' : 'check'} size={16} />
            <span>
              {check.error ?? <>Set <strong>{dayName}</strong> at <strong>{formatInZone(check.iso, branch.timezone, { hour: 'numeric', minute: '2-digit' })}</strong></>}
            </span>
            {check.error && <button type="button" className="link" onClick={() => pickCustom(active, firstMinutes(active))}>Earliest: {active.slots[0].label}</button>}
          </div>
          {active.hours && <p className="hint">Open {active.hours} {dayName}.</p>}
        </div>
      )}
    </div>
  )
}
