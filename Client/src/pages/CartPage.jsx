import Icon from '../components/Icon.jsx'
import PageHero from '../components/PageHero.jsx'
import { money } from '../lib.js'

export default function CartPage({ cart, user, navigate, openAuth, changeQuantity }) {
  const { branch, items } = cart
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <main>
      <PageHero
        compact
        eyebrow="Your next good meal"
        title={<>Your <em>cart.</em></>}
        lede={branch ? `From ${branch.groupName} · ${branch.branchName}` : 'Nothing here yet — let’s fix that.'}
      />
      <div className="wrap overlap">

      {items.length === 0 ? (
        <div className="state" style={{ marginBottom: 80, background: 'var(--white)' }}>
          <span className="state-icon"><Icon name="bag" /></span>
          <h2>Your cart is empty</h2>
          <p>Find a kitchen, pick your dishes, and pre-order for when you arrive.</p>
          <button className="btn btn-primary" onClick={() => navigate('explore')}>Explore food <Icon name="arrow" size={16} /></button>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {items.map((item, index) => (
              <article className="cart-item reveal" style={{ animationDelay: `${index * 60}ms` }} key={item.key}>
                <div className="thumb" style={item.image ? { backgroundImage: `url(${item.image})` } : undefined}>{!item.image && item.name.charAt(0)}</div>
                <div>
                  <strong>{item.name}</strong>
                  {item.variantName && <small>{item.variantName}</small>}
                  <div className="line-price">{money(item.price * item.quantity)}</div>
                </div>
                <div className="stepper">
                  <button onClick={() => changeQuantity(item.key, -1)} aria-label={`Remove one ${item.name}`}>−</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => changeQuantity(item.key, 1)} aria-label={`Add one ${item.name}`}>+</button>
                </div>
              </article>
            ))}
            <button className="link" style={{ justifySelf: 'start', marginTop: 6 }} onClick={() => navigate('restaurant', branch.slug)}><Icon name="back" size={16} /> Add more from {branch.branchName}</button>
          </div>

          <aside className="receipt">
            <span className="eyebrow plain">{branch.groupName} · {branch.branchName}</span>
            <h2>Order summary</h2>
            <span className="sub">{count} {count === 1 ? 'item' : 'items'}</span>
            <div className="rule" />
            <div className="rows">
              {items.map((item) => (
                <div className="row" key={item.key}><b>{item.quantity}×</b><span className="name">{item.name}{item.variantName && <small> · {item.variantName}</small>}</span><span className="amt">{money(item.price * item.quantity)}</span></div>
              ))}
            </div>
            <div className="rule" />
            <div className="total"><span>Subtotal</span><strong>{money(total)}</strong></div>
            <p className="note">Next, choose a pre-order time{branch.acceptsDelivery ? ' or delivery' : ''}.</p>
            <button className="btn btn-primary btn-block" onClick={() => user ? navigate('checkout') : openAuth('login', 'checkout')}>
              {user ? 'Continue to checkout' : 'Sign in to check out'} <Icon name="arrow" size={16} />
            </button>
            <p className="thanks">Thank you for eating local</p>
          </aside>
          <div className="checkout-bar">
            <span><small>{count} {count === 1 ? 'item' : 'items'}</small><strong>{money(total)}</strong></span>
            <button className="btn btn-primary" onClick={() => user ? navigate('checkout') : openAuth('login', 'checkout')}>
              {user ? 'Checkout' : 'Sign in to check out'} <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>
      )}
      </div>
    </main>
  )
}
