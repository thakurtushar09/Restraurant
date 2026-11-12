import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { api, timeAgo, NOTIFICATION_ICONS } from '../lib.js'
import { getPushState, enablePush, disablePush, syncPush } from '../push.js'

const AUDIENCE = 'CUSTOMER'

// Bell + dropdown for the signed-in customer. Loads history, then listens on a
// Server-Sent Events stream so order updates arrive the moment they happen.
export default function NotificationBell({ navigate, onNotify }) {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [pushState, setPushState] = useState(null)
  const [pushBusy, setPushBusy] = useState(false)
  const rootRef = useRef(null)
  const onNotifyRef = useRef(onNotify)
  useEffect(() => { onNotifyRef.current = onNotify }, [onNotify])

  useEffect(() => {
    const controller = new AbortController()
    // IDs already shown, so the stream and the fallback poll never double up.
    const seen = new Set()

    const handle = (notification) => {
      if (seen.has(notification.id)) return
      seen.add(notification.id)
      setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 50))
      setUnread((count) => count + 1)
      onNotifyRef.current?.(notification)
      if (notification.orderId) window.dispatchEvent(new CustomEvent('order-update', { detail: { orderId: notification.orderId } }))
    }

    const fetchList = () => api('/notifications?audience=CUSTOMER', { signal: controller.signal })

    fetchList()
      .then((result) => {
        result.data.forEach((item) => seen.add(item.id))
        setItems(result.data)
        setUnread(result.unread)
      })
      .catch(() => { /* the bell just starts empty */ })

    // Make sure this device's push subscription belongs to whoever is signed in now.
    syncPush(AUDIENCE).finally(() => getPushState().then(setPushState))

    // Live stream; EventSource reconnects on its own if the connection drops.
    const source = new EventSource('/api/v1/notifications/stream?audience=CUSTOMER')
    source.addEventListener('notification', (event) => handle(JSON.parse(event.data)))

    // Fallback for networks/proxies that buffer streams (e.g. some tunnels): check every 20s.
    const poll = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      fetchList()
        .then((result) => {
          result.data.slice().reverse().forEach(handle)
          setUnread(result.unread)
        })
        .catch(() => { /* try again next time */ })
    }, 20000)

    return () => { controller.abort(); source.close(); window.clearInterval(poll) }
  }, [])

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined
    const onClick = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  async function openItem(item) {
    setOpen(false)
    if (!item.readAt) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry))
      setUnread((count) => Math.max(0, count - 1))
      api(`/notifications/${item.id}/read`, { method: 'PATCH', body: {} }).catch(() => {})
    }
    if (item.orderId) navigate('order', item.orderId)
  }

  async function markAll() {
    setItems((current) => current.map((entry) => entry.readAt ? entry : { ...entry, readAt: new Date().toISOString() }))
    setUnread(0)
    api('/notifications/read-all?audience=CUSTOMER', { method: 'PATCH', body: {} }).catch(() => {})
  }


  async function togglePush() {
    setPushBusy(true)
    try {
      setPushState(pushState === 'on' ? await disablePush() : await enablePush(AUDIENCE))
    } catch {
      setPushState(await getPushState())
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="bell" ref={rootRef}>
      <button className={`bell-btn${unread ? ' has-unread' : ''}`} onClick={() => setOpen((value) => !value)} aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Icon name="bell" size={19} />
        {unread > 0 && <span className="bell-count" key={unread}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            {unread > 0 && <button className="link" onClick={markAll}>Mark all read</button>}
          </div>
          <PushToggle state={pushState} busy={pushBusy} onToggle={togglePush} />
          <div className="bell-list">
            {items.length === 0 ? (
              <p className="bell-empty">You’ll see updates about your orders here — confirmations, cooking, and when your table is ready.</p>
            ) : items.map((item) => (
              <button key={item.id} className={`bell-item${item.readAt ? '' : ' unread'}`} onClick={() => openItem(item)}>
                <span className="bell-icon"><Icon name={NOTIFICATION_ICONS[item.type] ?? 'info'} size={16} /></span>
                <span className="bell-text"><strong>{item.title}</strong><span>{item.body}</span><small>{timeAgo(item.createdAt)}</small></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Turn web push on/off for this device, with guidance when it isn't possible.
function PushToggle({ state, busy, onToggle }) {
  if (state === 'unsupported' || state === null) return null
  if (state === 'needs-install') {
    return <p className="bell-push muted"><Icon name="bell" size={15} /> To get alerts on iPhone, tap Share → “Add to Home Screen”, then open the app from there.</p>
  }
  if (state === 'denied') {
    return <p className="bell-push muted"><Icon name="bell" size={15} /> Notifications are blocked. Allow them for this site in your browser settings.</p>
  }
  return (
    <div className={`bell-push${state === 'on' ? ' on' : ''}`}>
      <Icon name="bell" size={15} />
      <span>{state === 'on' ? 'Phone & desktop alerts are on for this device' : 'Get alerts on this device, even when the site is closed'}</span>
      <button className="push-switch" role="switch" aria-checked={state === 'on'} disabled={busy} onClick={onToggle} aria-label="Push notifications"><i /></button>
    </div>
  )
}
