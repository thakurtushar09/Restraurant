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
