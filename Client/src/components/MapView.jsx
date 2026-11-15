import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TILE_URL, TILE_ATTRIBUTION, DEFAULT_CENTER } from '../geo.js'

const icon = (kind) => L.divIcon({ className: `map-pin${kind === 'you' ? ' you' : ''}`, html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -26] })

// Read-only map. markers: [{ id, latitude, longitude, label, kind?: 'you', onClick? }];
// circle: { latitude, longitude, radiusKm } for a delivery area.
export default function MapView({ markers, circle, height = 360, label = 'Map' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const latest = useRef({ markers, circle })
  // Redraw (and re-fit) only when pins move, not whenever the parent re-renders.
  const signature = JSON.stringify([markers.map((m) => [m.id, m.latitude, m.longitude, m.label]), circle])

  useEffect(() => { latest.current = { markers, circle } })

  useEffect(() => {
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 4)
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map) return
    const { markers, circle } = latest.current
    layer.clearLayers()
    const bounds = []
    for (const marker of markers) {
      const point = [marker.latitude, marker.longitude]
      bounds.push(point)
      const pin = L.marker(point, { icon: icon(marker.kind), title: marker.label, keyboard: true }).addTo(layer)
      if (marker.label) pin.bindTooltip(marker.label, { direction: 'top', offset: [0, -26] })
      if (marker.onClick) pin.on('click', () => latest.current.markers.find((m) => m.id === marker.id)?.onClick?.())
    }
    if (circle) {
      const area = L.circle([circle.latitude, circle.longitude], { radius: circle.radiusKm * 1000, color: '#29453a', weight: 1.5, fillOpacity: 0.07, interactive: false }).addTo(layer)
      bounds.push(...[area.getBounds().getNorthWest(), area.getBounds().getSouthEast()].map((p) => [p.lat, p.lng]))
    }
    if (bounds.length === 1) map.setView(bounds[0], 15)
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 })
  }, [signature])

  return <div className="map-canvas" ref={containerRef} style={{ height }} role="region" aria-label={label} />
}
