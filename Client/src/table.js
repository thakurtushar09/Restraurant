// The restaurant whose QR a guest scanned, kept for a few hours so a sign-in detour or a second round
// still offers "at my table" at checkout. Shape: { publicSlug, expiresAt }.
const DINE_IN_KEY = 'name:dine-in'
const DINE_IN_HOURS = 4

export function loadDineIn() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(DINE_IN_KEY))
    if (saved?.publicSlug && saved.expiresAt > Date.now()) return saved
  } catch { /* storage unavailable or corrupt */ }
  return null
}

export function saveDineIn(dineIn) {
  try {
    if (dineIn) window.localStorage.setItem(DINE_IN_KEY, JSON.stringify(dineIn))
    else window.localStorage.removeItem(DINE_IN_KEY)
  } catch { /* storage unavailable */ }
}

export const startDineIn = (publicSlug) => ({ publicSlug, expiresAt: Date.now() + DINE_IN_HOURS * 3600000 })

// The QR holds the menu link, /restaurant/<slug>?scan=1. Accept it from any host (dev, prod) or as a bare path.
export function slugFromScan(text) {
  try {
    const url = new URL(text.trim(), window.location.origin)
    const match = url.pathname.match(/^\/restaurant\/([^/]+)\/?$/)
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

// Opened straight from a printed QR: the guest is at the restaurant now.
export const openedFromScan = () => new URLSearchParams(window.location.search).has('scan')
