import { useRef, useState } from 'react'

const SIZE = 240
const CENTER = SIZE / 2
const RADIUS = 92
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTE_MARKS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

const pad = (value) => String(value).padStart(2, '0')
const at = (angle, radius) => ({ x: CENTER + radius * Math.sin(angle), y: CENTER - radius * Math.cos(angle) })

// Analog clock: pick the hour, then the minute (drag or tap), plus AM/PM.
// `minutes` is minutes past midnight (0–1439); onChange gets the same.
export default function ClockPicker({ minutes, onChange }) {
  const [mode, setMode] = useState('hour')
  const dialRef = useRef(null)
  const dragging = useRef(false)

  const hour24 = Math.floor(minutes / 60)
  const minute = minutes % 60
  const hour12 = hour24 % 12 || 12
  const pm = hour24 >= 12

  const setTime = (nextHour12, nextMinute, nextPm) => onChange(((nextHour12 % 12) + (nextPm ? 12 : 0)) * 60 + nextMinute)

  function valueFromPointer(event) {
    const rect = dialRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) * (SIZE / rect.width) - CENTER
    const y = (event.clientY - rect.top) * (SIZE / rect.height) - CENTER
    const degrees = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360
    if (mode === 'hour') setTime(Math.round(degrees / 30) % 12 || 12, minute, pm)
    else setTime(hour12, Math.round(degrees / 6) % 60, pm)
  }

  function onPointerDown(event) {
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    valueFromPointer(event)
  }

  function onPointerUp() {
    if (!dragging.current) return
    dragging.current = false
    if (mode === 'hour') setMode('minute')
  }

  function onKeyDown(event) {
    const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[event.key]
    if (!step) return
    event.preventDefault()
    if (mode === 'hour') onChange((minutes + step * 60 + 1440) % 1440)
    else setTime(hour12, (minute + step + 60) % 60, pm)
  }

  const handAngle = mode === 'hour' ? (hour12 % 12) * Math.PI / 6 : minute * Math.PI / 30
  const knob = at(handAngle, RADIUS)
  const onMark = mode === 'hour' || minute % 5 === 0

  return (
    <div className="clock">
      <div className="clock-readout">
        <div className="clock-digits">
          <button type="button" className={mode === 'hour' ? 'active' : ''} onClick={() => setMode('hour')} aria-label={`Hour, ${hour12}`}>{pad(hour12)}</button>
          <span aria-hidden="true">:</span>
          <button type="button" className={mode === 'minute' ? 'active' : ''} onClick={() => setMode('minute')} aria-label={`Minute, ${pad(minute)}`}>{pad(minute)}</button>
        </div>
        <div className="clock-ampm" role="group" aria-label="AM or PM">
          <button type="button" aria-pressed={!pm} onClick={() => pm && setTime(hour12, minute, false)}>AM</button>
          <button type="button" aria-pressed={pm} onClick={() => !pm && setTime(hour12, minute, true)}>PM</button>
        </div>
      </div>

      <svg
        ref={dialRef}
        className={`clock-dial ${mode}`}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="slider"
        tabIndex={0}
        aria-label={mode === 'hour' ? 'Hour' : 'Minute'}
        aria-valuemin={mode === 'hour' ? 1 : 0}
        aria-valuemax={mode === 'hour' ? 12 : 59}
        aria-valuenow={mode === 'hour' ? hour12 : minute}
        aria-valuetext={`${hour12}:${pad(minute)} ${pm ? 'PM' : 'AM'}`}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => dragging.current && valueFromPointer(event)}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <circle className="face" cx={CENTER} cy={CENTER} r={CENTER - 4} />
        {mode === 'minute' && Array.from({ length: 60 }, (_, i) => {
          const outer = at(i * Math.PI / 30, CENTER - 12)
          const inner = at(i * Math.PI / 30, CENTER - (i % 5 ? 16 : 19))
          return <line key={i} className="tick" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />
        })}
        <line className="hand" x1={CENTER} y1={CENTER} x2={knob.x} y2={knob.y} />
        <circle className="hub" cx={CENTER} cy={CENTER} r="4" />
        <circle className="knob" cx={knob.x} cy={knob.y} r="19" />
        {!onMark && <circle className="knob-dot" cx={knob.x} cy={knob.y} r="3" />}
        {(mode === 'hour' ? HOURS : MINUTE_MARKS).map((value, i) => {
          const point = at(i * Math.PI / 6, RADIUS)
          const selected = mode === 'hour' ? value === hour12 : value === minute
          return <text key={value} className={selected ? 'num selected' : 'num'} x={point.x} y={point.y}>{mode === 'hour' ? value : pad(value)}</text>
        })}
      </svg>
      <p className="clock-tip">{mode === 'hour' ? 'Tap or drag to the hour' : 'Now pick the minute — any minute works'}</p>
    </div>
  )
}
