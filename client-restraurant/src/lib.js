// API client — Vite proxies /api to the Express server, so the auth cookie is same-origin.
export async function api(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`/api/v1${path}`, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  let result = null
  try { result = await response.json() } catch { /* empty or non-JSON body */ }
  if (!response.ok || !result?.success) {
    const error = new Error(result?.message || `Request failed (${response.status})`)
    error.status = response.status
    // Session ended elsewhere (password changed, account suspended): App signs out locally.
    if (response.status === 401) window.dispatchEvent(new CustomEvent('app:unauthorized', { detail: { message: error.message } }))
    throw error
  }
  return result
}

// Toasts are fired from anywhere and rendered by <Toasts />.
export function toast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }))
}

// ---------- roles (mirror Server/src/middleware + order-management rules) ----------
export const ROLE_LABELS = {
  GROUP_OWNER: 'Owner',
  GROUP_ADMIN: 'Admin',
  BRANCH_MANAGER: 'Branch manager',
  KITCHEN_STAFF: 'Kitchen',
  DELIVERY_STAFF: 'Delivery',
}
export const GROUP_ROLES = ['GROUP_OWNER', 'GROUP_ADMIN']
export const MANAGEMENT_ROLES = ['GROUP_OWNER', 'GROUP_ADMIN', 'BRANCH_MANAGER']
export const BRANCH_ROLES = ['BRANCH_MANAGER', 'KITCHEN_STAFF', 'DELIVERY_STAFF']

export const canManageMenu = (role) => MANAGEMENT_ROLES.includes(role)
export const canManageGroup = (role) => GROUP_ROLES.includes(role)
export const canUseKitchen = (role) => MANAGEMENT_ROLES.includes(role) || role === 'KITCHEN_STAFF'
export const canUseDeliveries = (role) => MANAGEMENT_ROLES.includes(role) || role === 'DELIVERY_STAFF'
// Roles a member may hand out (mirrors member.controllers.ts on the server).
export const assignableRoles = (role) => role === 'BRANCH_MANAGER' ? ['KITCHEN_STAFF', 'DELIVERY_STAFF'] : BRANCH_ROLES

// Where each role lands after signing in.
export function homePageFor(role) {
  if (role === 'KITCHEN_STAFF') return 'kitchen'
  if (role === 'DELIVERY_STAFF') return 'deliveries'
  return 'overview'
}

// Flatten memberships into one workspace per branch the user can open.
export function buildWorkspaces(memberships) {
  const workspaces = []
  for (const membership of memberships) {
    const group = membership.restaurantGroup
    const branches = membership.branchId ? [membership.branch] : group.branches ?? []
    for (const branch of branches) {
      if (!branch || workspaces.some((workspace) => workspace.branchId === branch.id)) continue
      workspaces.push({
        branchId: branch.id,
        branch,
        groupId: group.id,
        groupName: group.groupName,
        role: membership.role,
      })
    }
  }
  return workspaces
}

// ---------- orders ----------
export const STATUS_META = {
  PENDING: { label: 'New', color: '#2a8158' },
  ACCEPTED: { label: 'Accepted', color: '#6b8f78' },
  PREPARING: { label: 'Preparing', color: '#4f7f99' },
  READY: { label: 'Ready', color: '#3a5d46' },
  OUT_FOR_DELIVERY: { label: 'On the way', color: '#5b6b8c' },
  COMPLETED: { label: 'Completed', color: '#29453a' },
  REJECTED: { label: 'Rejected', color: '#9ba196' },
  CANCELLED: { label: 'Cancelled', color: '#9ba196' },
  EXPIRED: { label: 'Expired', color: '#9ba196' },
}
export const ACTIVE_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']
export const CLOSED_STATUSES = ['COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED']
// DINE_IN orders are pre-orders: the guest picks an arrival time and the food is ready when they sit down.
export const FULFILLMENT_LABELS = { DELIVERY: 'Delivery', PICKUP: 'Pickup', DINE_IN: 'Pre-order' }

export function scheduleLabel(order) {
  return order.fulfillmentType === 'DINE_IN' ? 'Arrives' : 'Deliver at'
}

// When the kitchen should start so a scheduled order is ready on time.
export function cookByTime(order, prepMinutes) {
  return order.scheduledAt ? new Date(new Date(order.scheduledAt).getTime() - prepMinutes * 60000) : null
}

// Next steps a role may take, matching updateOrderStatus on the server.
export function nextActions(order, role) {
  const management = MANAGEMENT_ROLES.includes(role)
  const kitchen = management || role === 'KITCHEN_STAFF'
  const delivery = management || role === 'DELIVERY_STAFF'
  const actions = []
  switch (order.orderStatus) {
    case 'PENDING':
      if (management) actions.push({ status: 'ACCEPTED', label: 'Accept', tone: 'primary' }, { status: 'REJECTED', label: 'Reject', tone: 'danger', needsReason: true })
      break
    case 'ACCEPTED':
      if (kitchen) actions.push({ status: 'PREPARING', label: 'Start cooking', tone: 'primary' })
      if (management) actions.push({ status: 'CANCELLED', label: 'Cancel', tone: 'danger', needsReason: true })
      break
    case 'PREPARING':
      if (kitchen) actions.push({ status: 'READY', label: 'Mark ready', tone: 'primary' })
      if (management) actions.push({ status: 'CANCELLED', label: 'Cancel', tone: 'danger', needsReason: true })
      break
    case 'READY':
      if (order.fulfillmentType === 'DELIVERY' && delivery) actions.push({ status: 'OUT_FOR_DELIVERY', label: 'Send out', tone: 'primary' })
      if (delivery) actions.push({ status: 'COMPLETED', label: order.fulfillmentType === 'DELIVERY' ? 'Delivered' : 'Served', tone: order.fulfillmentType === 'DELIVERY' ? 'ghost' : 'primary' })
      if (management) actions.push({ status: 'CANCELLED', label: 'Cancel', tone: 'danger', needsReason: true })
      break
    case 'OUT_FOR_DELIVERY':
      if (delivery) actions.push({ status: 'COMPLETED', label: 'Delivered', tone: 'primary' })
      break
  }
  return actions
}

// Opens the customer's address in the phone's maps app.
export function mapsUrl(order) {
  const query = order.deliveryLatitude && order.deliveryLongitude
    ? `${order.deliveryLatitude},${order.deliveryLongitude}`
    : [order.deliveryAddressLine1, order.deliveryAddressLine2, order.deliveryCity, order.deliveryPostalCode].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

// Minutes until (positive) or since (negative) a date.
export function minutesFrom(date, now = Date.now()) {
  return Math.round((new Date(date).getTime() - now) / 60000)
}

export function duration(minutes) {
  const value = Math.abs(minutes)
  if (value < 60) return `${value}m`
  return `${Math.floor(value / 60)}h ${value % 60}m`
}

// ---------- accounts ----------
// Readable temporary password for new teammates, e.g. "k7Qm-p2Xw-9fRt".
export function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length])
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8).join('')}`
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    toast('Copied')
  } catch {
    toast('Couldn’t copy — select the text instead', 'error')
  }
}

// ---------- formatting ----------
export function money(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(Number(value) || 0)
}

export function timeAgo(date, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(date).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d`
}

export function clock(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function shortDate(date) {
  return new Date(date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '?'
}

export function isToday(date) {
  const value = new Date(date)
  const today = new Date()
  return value.toDateString() === today.toDateString()
}

// ---------- branch form (mirrors Server/src/utils/branch-input.ts) ----------
export const WEEK_DAYS = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
  ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
]
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD']
export const BRANCH_STATUS_LABELS = { ACTIVE: 'Open', TEMPORARILY_CLOSED: 'Temporarily closed', INACTIVE: 'Inactive' }
export const PHONE_PATTERN = '\\+?[0-9][0-9\\s\\-]{6,18}'

export function timezones() {
  try { return Intl.supportedValuesOf('timeZone') } catch { return ['Asia/Kolkata', 'UTC'] }
}

const defaultHours = () => Object.fromEntries(WEEK_DAYS.map(([day]) => [day, { closed: false, open: '09:00', close: '22:00' }]))

export function emptyBranchForm() {
  return {
    branchName: '', phone: '', email: '',
    addressLine1: '', addressLine2: '', landmark: '', city: '', state: '', postalCode: '', country: 'India',
    latitude: '', longitude: '',
    timezone: 'Asia/Kolkata', currency: 'INR', averagePreparationTimeMinutes: '30',
    acceptsDelivery: true, acceptsPickup: false, acceptsDineIn: true,
    openingHours: defaultHours(),
    status: 'ACTIVE',
  }
}

export function branchToForm(branch) {
  const form = emptyBranchForm()
  for (const key of Object.keys(form)) {
    if (branch[key] !== null && branch[key] !== undefined) form[key] = typeof form[key] === 'string' ? String(branch[key]) : branch[key]
  }
  // Older branches may have no hours saved yet.
  form.openingHours = { ...defaultHours(), ...(branch.openingHours ?? {}) }
  return form
}

export function branchFormToPayload(form, { includeStatus = false } = {}) {
  const coordinate = (value) => value === '' ? null : Number(value)
  const { status, ...fields } = form
  return {
    ...fields,
    acceptsPickup: false, // pickup is switched off for now
    averagePreparationTimeMinutes: Number.parseInt(form.averagePreparationTimeMinutes, 10),
    latitude: coordinate(form.latitude),
    longitude: coordinate(form.longitude),
    openingHours: Object.fromEntries(WEEK_DAYS.map(([day]) => {
      const entry = form.openingHours[day]
      return [day, entry.closed ? { closed: true } : { closed: false, open: entry.open, close: entry.close }]
    })),
    ...(includeStatus ? { status } : {}),
  }
}

// Same rules as the server, checked before submitting so the user sees them early.
export function branchFormProblem(form) {
  if (!form.acceptsDelivery && !form.acceptsDineIn) return 'Turn on delivery, pre-orders, or both.'
  const days = WEEK_DAYS.map(([day, label]) => [label, form.openingHours[day]])
  if (days.every(([, entry]) => entry.closed)) return 'The branch must be open on at least one day.'
  const same = days.find(([, entry]) => !entry.closed && entry.open === entry.close)
  if (same) return `${same[0]}: opening and closing times can’t be the same.`
  return null
}
