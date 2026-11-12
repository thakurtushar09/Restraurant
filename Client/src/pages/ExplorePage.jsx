import { useEffect, useState } from 'react'
import Icon from '../components/Icon.jsx'
import RestaurantCard from '../components/RestaurantCard.jsx'
import PageHero from '../components/PageHero.jsx'

export default function ExplorePage({ search, setSearch, openRestaurant }) {
  const [city, setCity] = useState('')
  const [fulfillment, setFulfillment] = useState('')
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

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
  }, [search, city, fulfillment, reload])

  const clearFilters = () => { setSearch(''); setCity(''); setFulfillment('') }

  return (
    <main>
      <PageHero
        eyebrow={<><span className="live" />Taking pre-orders now</>}
        title={<>Find your next <em>favourite table.</em></>}
        lede="Pre-order and walk in to a meal that’s ready when you are — or have it delivered."
      />
      <div className="wrap">
      <div className="filters overlap" aria-label="Restaurant filters">
        <label className="city"><Icon name="pin" size={16} /><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Filter by city" aria-label="Filter by city" /></label>
        <div className="segmented" role="group" aria-label="Fulfillment">
          {[['', 'All'], ['PREORDER', 'Pre-order'], ['DELIVERY', 'Delivery']].map(([value, label]) => (
            <button key={label} className={fulfillment === value ? 'active' : ''} aria-pressed={fulfillment === value} onClick={() => setFulfillment(value)}>{label}</button>
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
          <div className="state"><span className="state-icon"><Icon name="search" /></span><h2>No kitchens found</h2><p>Try a different search or city.</p><button className="link" onClick={clearFilters}>Clear filters</button></div>
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
