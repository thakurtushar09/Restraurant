export const money = (value) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export async function api(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`/api/v1${path}`, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  let result = null
  try { result = await response.json() } catch { /* empty body */ }
  if (!response.ok || !result?.success) {
    const error = new Error(result?.message || `Request failed (${response.status})`)
    error.status = response.status
    // Session ended elsewhere (password changed, account suspended): App signs out locally.
    if (response.status === 401) window.dispatchEvent(new CustomEvent('app:unauthorized', { detail: { message: error.message } }))
    throw error
  }
  return result
}

// ---------- order wording for customers ----------
// DINE_IN orders are pre-orders: the guest picks an arrival time and the food is ready when they sit down.
export const FULFILLMENT_LABELS = { DINE_IN: 'Pre-order', DELIVERY: 'Delivery' }

export function statusLabel(order) {
  const preorder = order.fulfillmentType === 'DINE_IN'
  return {
    PENDING: 'Waiting for the restaurant',
    ACCEPTED: 'Confirmed',
    PREPARING: 'Being prepared',
    READY: preorder ? 'Ready for you' : 'Ready',
    OUT_FOR_DELIVERY: 'On the way',
    COMPLETED: preorder ? 'Enjoyed' : 'Delivered',
    REJECTED: 'Declined',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Not confirmed in time',
  }[order.orderStatus] ?? order.orderStatus
}

export const ACTIVE_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']

// ---------- time slots in the restaurant's timezone ----------
// Mirrors Server/src/utils/opening-hours.ts so customers only see times the server will accept.
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const SLOT_MINUTES = 15
const MAX_DAYS = 7
const formatters = new Map()

function formatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }))
  }
  return formatters.get(timeZone)
}

function zonedParts(date, timeZone) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(date).map((part) => [part.type, part.value]))
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    weekday: parts.weekday.toLowerCase().slice(0, 3),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

// Instant for a wall-clock time in `timeZone` (two passes settle DST shifts).
function zonedTimeToDate(year, month, day, minutes, timeZone) {
  const wall = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60)
  let guess = wall
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone)
    const seen = Date.UTC(p.year, p.month - 1, p.day, Math.floor(p.minutes / 60), p.minutes % 60)
    guess += wall - seen
  }
  return new Date(guess)
}

const toMinutes = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m }

export function isOpenAt(hours, timeZone, date) {
  if (!hours) return true
  const { weekday, minutes } = zonedParts(date, timeZone)
  const today = hours[weekday]
  if (today && !today.closed) {
    const open = toMinutes(today.open)
    const close = toMinutes(today.close)
    if (close > open ? minutes >= open && minutes < close : minutes >= open) return true
  }
  const previous = hours[DAY_KEYS[(DAY_KEYS.indexOf(weekday) + 6) % 7]]
  if (previous && !previous.closed) {
    const open = toMinutes(previous.open)
    const close = toMinutes(previous.close)
    if (close < open && minutes < close) return true
  }
  return false
}

// [{ key, label, slots: [{ iso, label }] }] for the next week, skipping days with no bookable time.
export function buildSlotDays(branch, now = new Date()) {
  const timeZone = branch.timezone || 'Asia/Kolkata'
  const earliest = now.getTime() + (branch.averagePreparationTimeMinutes ?? 30) * 60000
  const latest = now.getTime() + MAX_DAYS * 24 * 60 * 60000
  const start = zonedParts(now, timeZone)
  const timeLabel = new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit' })
  const dayLabel = new Intl.DateTimeFormat('en-IN', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })
  const days = []

  for (let offset = 0; offset <= MAX_DAYS; offset++) {
    // Noon avoids DST edges when stepping whole days.
    const noon = zonedTimeToDate(start.year, start.month, start.day, 12 * 60, timeZone)
    const dayDate = new Date(noon.getTime() + offset * 24 * 60 * 60000)
    const { year, month, day } = zonedParts(dayDate, timeZone)
    const slots = []
    for (let minutes = 0; minutes < 24 * 60; minutes += SLOT_MINUTES) {
      const instant = zonedTimeToDate(year, month, day, minutes, timeZone)
      const time = instant.getTime()
      if (time < earliest || time > latest) continue
      if (!isOpenAt(branch.openingHours, timeZone, instant)) continue
      slots.push({ iso: instant.toISOString(), label: timeLabel.format(instant) })
    }
    if (slots.length) {
      days.push({
        key: `${year}-${month}-${day}`,
        label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : dayLabel.format(dayDate),
        slots,
      })
    }
  }
  return days
}

export function formatInZone(iso, timeZone, options = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: timeZone || 'Asia/Kolkata', ...options }).format(new Date(iso))
}

// ---------- cart persistence ----------
const CART_KEY = 'name:cart'
export function loadCart() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(CART_KEY))
    if (saved && Array.isArray(saved.items)) return saved
  } catch { /* storage unavailable or corrupt */ }
  return { branch: null, items: [] }
}
export function saveCart(cart) {
  try { window.localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch { /* storage unavailable */ }
}

export function timeAgo(date) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

// Icon for each notification type sent by Server/src/utils/notify.ts.
export const NOTIFICATION_ICONS = {
  PLACED: 'receipt', ACCEPTED: 'check', PREPARING: 'flame', READY: 'plate', OUT_FOR_DELIVERY: 'bike',
  COMPLETED: 'check', REJECTED: 'alert', CANCELLED_BY_RESTAURANT: 'alert', EXPIRED: 'alert', ARRIVAL_REMINDER: 'calendar',
}
