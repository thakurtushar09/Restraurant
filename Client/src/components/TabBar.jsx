import Icon from './Icon.jsx'

// Phone/tablet navigation pinned to the bottom of the screen; the header's nav links are hidden at that size.
export default function TabBar({ page, user, count, navigate, openAuth, onScan }) {
  const tab = (key, label, icon, active, onClick, badge) => (
    <a
      key={key}
      href={key === 'home' ? '/' : `/${key}`}
      className={`tab${active ? ' active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => { event.preventDefault(); onClick() }}
    >
      <span className="tab-icon"><Icon name={icon} size={21} />{badge > 0 && <span className="tab-badge" key={badge}>{badge}</span>}</span>
      <span className="tab-label">{label}</span>
    </a>
  )

  return (
    <nav className="tabbar" aria-label="Main navigation">
      {tab('home', 'Home', 'home', page === 'home', () => navigate('home'))}
      {tab('explore', 'Explore', 'search', page === 'explore' || page === 'restaurant', () => navigate('explore'))}
      <button type="button" className="tab tab-scan" onClick={onScan} aria-label="Scan a table QR code">
        <span className="tab-icon"><Icon name="scan" size={22} /></span>
        <span className="tab-label">Scan</span>
      </button>
      {user
        ? tab('orders', 'Orders', 'receipt', page === 'orders' || page === 'order', () => navigate('orders'))
        : tab('login', 'Log in', 'user', page === 'auth', () => openAuth('login'))}
      {tab('cart', 'Cart', 'bag', page === 'cart' || page === 'checkout', () => navigate('cart'), count)}
    </nav>
  )
}
