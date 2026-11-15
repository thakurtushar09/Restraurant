// Map tiles and geocoding come from OpenStreetMap (no API key). Nominatim allows ~1 request/second,
// so search runs on submit only, never while typing.
export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
export const DEFAULT_CENTER = [20.5937, 78.9629] // India

const NOMINATIM = 'https://nominatim.openstreetmap.org'

export async function searchPlaces(query, signal) {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '5' })
  const response = await fetch(`${NOMINATIM}/search?${params}`, { signal, headers: { 'Accept-Language': 'en' } })
  if (!response.ok) throw new Error('Search is unavailable right now')
  const results = await response.json()
  return results.map((place) => ({ id: place.place_id, label: place.display_name, latitude: Number(place.lat), longitude: Number(place.lon), address: place.address }))
}

export async function reverseGeocode(latitude, longitude, signal) {
  const params = new URLSearchParams({ lat: latitude, lon: longitude, format: 'jsonv2', addressdetails: '1' })
  const response = await fetch(`${NOMINATIM}/reverse?${params}`, { signal, headers: { 'Accept-Language': 'en' } })
  if (!response.ok) throw new Error('Could not look up this location')
  const result = await response.json()
  if (result.error) throw new Error('No address found at this pin')
  return result
}

// Nominatim address parts → our address fields (empty strings when unknown).
export function addressFromPlace(place) {
  const a = place.address ?? {}
  return {
    addressLine1: [a.house_number, a.road].filter(Boolean).join(' ') || a.building || a.amenity || '',
    addressLine2: a.neighbourhood || a.suburb || a.quarter || '',
    city: a.city || a.town || a.village || a.municipality || a.county || '',
    state: a.state || a.region || '',
    postalCode: a.postcode || '',
    country: a.country || '',
  }
}

export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available in this browser.'))
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => reject(new Error('Could not get your location. Allow location access or place the pin on the map.')),
      { timeout: 10000, enableHighAccuracy: true },
    )
  })
}

export const round6 = (value) => Math.round(value * 1e6) / 1e6

// ---------- customer location (kept in this browser) ----------
const LOCATION_KEY = 'name:location'
export function loadLocation() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LOCATION_KEY))
    if (saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) return saved
  } catch { /* storage unavailable or corrupt */ }
  return null
}
export function saveLocation(location) {
  try {
    if (location) window.localStorage.setItem(LOCATION_KEY, JSON.stringify(location))
    else window.localStorage.removeItem(LOCATION_KEY)
  } catch { /* storage unavailable */ }
}

// Short "Indiranagar, Bengaluru" style name for a pin.
export async function placeLabel(latitude, longitude) {
  try {
    const a = (await reverseGeocode(latitude, longitude)).address ?? {}
    return [a.neighbourhood || a.suburb || a.quarter, a.city || a.town || a.village || a.county].filter(Boolean).join(', ') || 'Pinned location'
  } catch {
    return 'Pinned location'
  }
}

// Same haversine as Server/src/utils/geo.ts.
export function distanceKm(from, to) {
  const rad = (degrees) => (degrees * Math.PI) / 180
  const dLat = rad(to.latitude - from.latitude)
  const dLng = rad(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

export const hasPoint = (place) => place?.latitude != null && place?.longitude != null && place.latitude !== '' && place.longitude !== ''
export const toPoint = (place) => hasPoint(place) ? { latitude: Number(place.latitude), longitude: Number(place.longitude) } : null

export const formatDistance = (km) => km < 1 ? `${Math.max(50, Math.round(km * 20) * 50)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`

export const directionsUrl = ({ latitude, longitude }) => `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`

// ---------- saved addresses ----------
const TYPE_LABELS = { HOME: 'Home', WORK: 'Work', OTHER: 'Other' }
export const addressTitle = (address) => address.label || TYPE_LABELS[address.addressType] || 'Address'
export const addressLine = (address) => [address.addressLine1, address.addressLine2, address.city, address.postalCode].filter(Boolean).join(', ')

// A saved address as the customer's current location (null when it has no map pin).
export function addressToLocation(address) {
  const point = toPoint(address)
  if (!point) return null
  return { ...point, label: `${addressTitle(address)} · ${address.addressLine2 || address.city}`, addressId: address.id }
}
