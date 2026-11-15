import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import RestaurantCard from '../components/RestaurantCard.jsx'
import PageHero from '../components/PageHero.jsx'
import LocationBar from '../components/LocationBar.jsx'
import MapView from '../components/MapView.jsx'

export default function ExplorePage({ search, setSearch, openRestaurant, location, setLocation, openLocationMenu }) {
  const [city, setCity] = useState('')
  const [fulfillment, setFulfillment] = useState('')
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [view, setView] = useState('list')

  // Debounced so typing in the header search doesn't fire a request per key.
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (city.trim()) params.set('city', city.trim())
      if (fulfillment) params.set('fulfillment', fulfillment)
      if (location) {
        params.set('lat', location.latitude)
        params.set('lng', location.longitude)
      }
      try {
        const response = await fetch(`/api/v1/public/branches?${params}`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.message || 'Could not load restaurants')
        setRestaurants(result.data)
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Could not load restaurants')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 220)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [search, city, fulfillment, location, reload])

  const clearFilters = () => { setSearch(''); setCity(''); setFulfillment('') }

  const markers = useMemo(() => [
    ...restaurants.filter((restaurant) => restaurant.latitude != null).map((restaurant) => ({
      id: restaurant.id,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
      label: `${restaurant.restaurantGroup.groupName} · ${restaurant.branchName}`,
      onClick: () => openRestaurant(restaurant.publicSlug),
    })),
    ...(location ? [{ id: 'you', kind: 'you', latitude: location.latitude, longitude: location.longitude, label: 'You are here' }] : []),
  ], [restaurants, location, openRestaurant])

  return (
    <main>
      <PageHero
        eyebrow={<><span className="live" />Taking pre-orders now</>}
        title={<>Find your next <em>favourite table.</em></>}
        lede="Pre-order and walk in to a meal that’s ready when you are — or have it delivered."
      />
      <div className="wrap">
      <div className="overlap"><LocationBar location={location} setLocation={setLocation} openLocationMenu={openLocationMenu} /></div>
      <div className="filters" aria-label="Restaurant filters">
        <label className="city"><Icon name="pin" size={16} /><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Filter by city" aria-label="Filter by city" /></label>
        <div className="segmented" role="group" aria-label="Fulfillment">
          {[['', 'All'], ['PREORDER', 'Pre-order'], ['DELIVERY', 'Delivery']].map(([value, label]) => (
            <button key={label} className={fulfillment === value ? 'active' : ''} aria-pressed={fulfillment === value} onClick={() => setFulfillment(value)}>{label}</button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="View">
          {[['list', 'List'], ['map', 'Map']].map(([value, label]) => (
            <button key={value} className={view === value ? 'active' : ''} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>
          ))}
        </div>
        <span className="count">{loading ? 'Searching…' : `${restaurants.length} ${restaurants.length === 1 ? 'kitchen' : 'kitchens'}`}</span>
      </div>

      <div style={{ paddingBottom: 80 }}>
        {error ? (
          <div className="state"><span className="state-icon"><Icon name="alert" /></span><h2>We couldn’t load restaurants</h2><p>{error}</p><button className="btn btn-primary" onClick={() => setReload((value) => value + 1)}>Try again</button></div>
        ) : loading && restaurants.length === 0 ? (
          <div className="restaurant-grid">{[0, 1, 2].map((key) => <div className="skeleton" key={key} style={{ height: 340 }} />)}</div>
        ) : restaurants.length === 0 ? (
          <div className="state"><span className="state-icon"><Icon name="search" /></span><h2>No kitchens found</h2><p>{location ? `No kitchens ${fulfillment === 'DELIVERY' ? 'deliver to' : 'are near'} ${location.label || 'your location'} yet. Try another spot or clear your location.` : 'Try a different search or city.'}</p><button className="link" onClick={clearFilters}>Clear filters</button></div>
        ) : view === 'map' ? (
          <div className="explore-map">
            <MapView markers={markers} height={520} label="Kitchens on a map" />
            {markers.length === (location ? 1 : 0) && <p className="hint">These kitchens haven’t pinned their location yet.</p>}
          </div>
        ) : (
          <div className="restaurant-grid">
            {restaurants.map((restaurant, index) => <RestaurantCard key={restaurant.id} restaurant={restaurant} index={index} onOpen={openRestaurant} />)}
          </div>
        )}
      </div>
      </div>
    </main>
  )
}
