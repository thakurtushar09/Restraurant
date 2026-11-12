import Icon from './Icon.jsx'

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()

export default function RestaurantCard({ restaurant, onOpen, index = 0 }) {
  const cover = restaurant.menuItems.find((item) => item.imageUrl)?.imageUrl
  const { groupName, logoUrl } = restaurant.restaurantGroup
  const open = () => onOpen(restaurant.publicSlug)

  return (
    <article
      className={`r-card reveal${logoUrl ? ' has-logo' : ''}`}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      onClick={open}
      onKeyDown={(event) => { if (event.key === 'Enter') open() }}
      tabIndex={0}
      aria-label={`${groupName}, ${restaurant.branchName}`}
    >
      <div className="r-cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
        {!cover && <span className="initials">{initials(groupName)}</span>}
        <span className="prep"><Icon name="clock" size={13} />{restaurant.averagePreparationTimeMinutes} min</span>
        {logoUrl && <img className="logo" src={logoUrl} alt="" />}
      </div>
      <div className="r-body">
        <span className="group">{groupName}</span>
        <h3>{restaurant.branchName}</h3>
        <span className="meta"><Icon name="pin" size={14} />{restaurant.city}, {restaurant.state}</span>
        {restaurant.menuItems.length > 0 && <span className="dishes">{restaurant.menuItems.map((item) => item.name).join(' · ')}</span>}
        <div className="chips">
          {restaurant.acceptsDineIn && <span className="chip">Pre-order</span>}
          {restaurant.acceptsDelivery && <span className="chip">Delivery</span>}
          <span className="chip chip-muted">{restaurant._count.menuItems} dishes</span>
        </div>
      </div>
    </article>
  )
}
