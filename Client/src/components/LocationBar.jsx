import { useState } from 'react'
import Icon from './Icon.jsx'
import { currentPosition, placeLabel } from '../geo.js'

// "Kitchens near …" summary on Explore. Changing it opens the navbar's location menu.
export default function LocationBar({ location, setLocation, openLocationMenu }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function locate() {
    setBusy(true)
    setError('')
    try {
      const position = await currentPosition()
      setLocation({ ...position, label: await placeLabel(position.latitude, position.longitude) })
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className={`location-bar${location ? ' set' : ''}`}>
      <span className="location-icon"><Icon name="pin" size={18} /></span>
      <div className="location-text">
        {location ? <>
          <small>Showing the nearest branch of each kitchen near</small>
          <strong>{location.label || 'your location'}</strong>
        </> : <>
          <strong>Where are you?</strong>
          <small>Pick a saved address or share your location to see the branches closest to you and who delivers there.</small>
        </>}
        {error && <small className="form-error">{error}</small>}
      </div>
      <div className="location-actions">
        {!location && <button type="button" className="btn btn-primary btn-sm" onClick={locate} disabled={busy}>{busy ? 'Locating…' : 'Use my location'}</button>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={openLocationMenu}>{location ? 'Change' : 'Choose address'}</button>
      </div>
    </div>
  )
}
