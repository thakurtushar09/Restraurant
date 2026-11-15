import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Icon from './Icon.jsx'
import { TILE_URL, TILE_ATTRIBUTION, DEFAULT_CENTER, searchPlaces, reverseGeocode, addressFromPlace, currentPosition, round6 } from '../geo.js'

const pinIcon = L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 28] })

// Map with a draggable pin. `value` is { latitude, longitude } (numbers, or null for no pin).
// `radiusKm` draws the delivery area; `onAddress` gets address fields looked up from the pin.
export default function LocationPicker({ value, onChange, radiusKm, onAddress }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const hasPin = value?.latitude != null && value?.longitude != null

  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 4)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    map.on('click', (event) => onChangeRef.current({ latitude: round6(event.latlng.lat), longitude: round6(event.latlng.lng) }))
    mapRef.current = map
    // The map may mount inside a drawer that is still animating open.
    const timer = window.setTimeout(() => map.invalidateSize(), 250)
    return () => { window.clearTimeout(timer); map.remove(); mapRef.current = null; markerRef.current = null; circleRef.current = null }
  }, [])

  // Keep the marker and delivery circle in sync with the value.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!hasPin) {
      markerRef.current?.remove(); markerRef.current = null
      circleRef.current?.remove(); circleRef.current = null
      return
    }
    const point = [value.latitude, value.longitude]
    if (!markerRef.current) {
      markerRef.current = L.marker(point, { icon: pinIcon, draggable: true, keyboard: true, title: 'Branch location' }).addTo(map)
      markerRef.current.on('dragend', () => {
        const { lat, lng } = markerRef.current.getLatLng()
        onChangeRef.current({ latitude: round6(lat), longitude: round6(lng) })
      })
      map.setView(point, Math.max(map.getZoom(), 15))
    } else {
      markerRef.current.setLatLng(point)
      if (!map.getBounds().contains(point)) map.panTo(point)
    }
    if (radiusKm > 0) {
      if (!circleRef.current) circleRef.current = L.circle(point, { radius: radiusKm * 1000, color: '#29453a', weight: 1.5, fillOpacity: 0.08, interactive: false }).addTo(map)
      circleRef.current.setLatLng(point).setRadius(radiusKm * 1000)
    } else {
      circleRef.current?.remove(); circleRef.current = null
    }
  }, [hasPin, value?.latitude, value?.longitude, radiusKm])

  function place(latitude, longitude) {
    onChange({ latitude: round6(latitude), longitude: round6(longitude) })
    mapRef.current?.setView([latitude, longitude], 16)
  }

  async function search() {
    if (!query.trim()) return
    setBusy('search'); setError(''); setResults([])
    try {
      const found = await searchPlaces(query.trim())
      if (!found.length) setError('No places found. Try adding the city or postal code.')
      setResults(found)
    } catch (err) { setError(err.message) }
    setBusy('')
  }

  async function locate() {
    setBusy('locate'); setError('')
    try {
      const position = await currentPosition()
      place(position.latitude, position.longitude)
    } catch (err) { setError(err.message) }
    setBusy('')
  }

  async function fillAddress() {
    setBusy('address'); setError('')
    try {
      onAddress(addressFromPlace(await reverseGeocode(value.latitude, value.longitude)))
    } catch (err) { setError(err.message) }
    setBusy('')
  }

  function choose(result) {
    place(result.latitude, result.longitude)
    setResults([])
    if (onAddress) onAddress(addressFromPlace(result))
  }

  return (
    <div className="location-picker">
      <div className="map-search">
        <Icon name="search" size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search() } }}
          placeholder="Search for the address or a landmark"
          aria-label="Search the map"
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={search} disabled={busy === 'search'}>{busy === 'search' ? 'Searching…' : 'Search'}</button>
      </div>
      {results.length > 0 && (
        <ul className="map-results">
          {results.map((result) => <li key={result.id}><button type="button" onClick={() => choose(result)}><Icon name="pin" size={14} />{result.label}</button></li>)}
        </ul>
      )}
      <div className="map-canvas" ref={containerRef} role="application" aria-label="Map. Click to place the pin, or drag it." />
      <div className="map-actions">
        <span className="form-hint">{hasPin ? `Pin at ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)} · drag to adjust` : 'Click the map to drop a pin on the entrance.'}</span>
        <span className="map-buttons">
          <button type="button" className="btn btn-ghost btn-sm" onClick={locate} disabled={busy === 'locate'}><Icon name="pin" size={14} />{busy === 'locate' ? 'Locating…' : 'Use my location'}</button>
          {onAddress && hasPin && <button type="button" className="btn btn-ghost btn-sm" onClick={fillAddress} disabled={busy === 'address'}>{busy === 'address' ? 'Looking up…' : 'Fill address from pin'}</button>}
          {hasPin && <button type="button" className="text-btn" onClick={() => onChange({ latitude: null, longitude: null })}>Remove pin</button>}
        </span>
      </div>
      {error && <p className="form-hint error">{error}</p>}
    </div>
  )
}
