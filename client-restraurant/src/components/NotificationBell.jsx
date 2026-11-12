import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { api, timeAgo } from '../lib.js'
import { getPushState, enablePush, disablePush, syncPush } from '../push.js'

const AUDIENCE = 'STAFF'
const SOUND_KEY = 'kitchen:sound'
// Types that need someone to act right away get a chime.
const CHIME_TYPES = ['PLACED', 'COOK_NOW']
const ICONS = { PLACED: 'receipt', COOK_NOW: 'flame', CANCELLED_BY_CUSTOMER: 'alert', EXPIRED: 'alert', RESCHEDULED: 'calendar', READY: 'bike' }
const ago = (date) => { const value = timeAgo(date); return value === 'just now' ? value : `${value} ago` }

function readSound() {
  try { return window.localStorage.getItem(SOUND_KEY) !== 'off' } catch { return true }
}

// Two soft notes via Web Audio, so there's no sound file to ship.
function chime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const context = chime.context ?? (chime.context = new AudioCtx())
    context.resume()
    ;[[880, 0], [1320, 0.16]].forEach(([frequency, offset]) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset)
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.5)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(context.currentTime + offset)
      oscillator.stop(context.currentTime + offset + 0.55)
    })
  } catch { /* audio unavailable */ }
}

export default function NotificationBell({ onNotify, onOpen }) {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [sound, setSound] = useState(readSound)
  const [pushState, setPushState] = useState(null)
  const [pushBusy, setPushBusy] = useState(false)
  const rootRef = useRef(null)
  const latest = useRef({ onNotify, sound })
  useEffect(() => { latest.current = { onNotify, sound } }, [onNotify, sound])

  useEffect(() => {
    const controller = new AbortController()
    // IDs already shown, so the stream and the fallback poll never double up.
    const seen = new Set()

    const handle = (notification) => {
      if (seen.has(notification.id)) return
      seen.add(notification.id)
      setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 60))
      setUnread((count) => count + 1)
      latest.current.onNotify?.(notification)
      if (latest.current.sound && CHIME_TYPES.includes(notification.type)) chime()
    }

    const fetchList = () => api('/notifications?audience=STAFF', { signal: controller.signal })

    fetchList()
      .then((result) => {
        result.data.forEach((item) => seen.add(item.id))
        setItems(result.data)
        setUnread(result.unread)
      })
      .catch(() => { /* starts empty */ })

    // Make sure this device's push subscription belongs to whoever is signed in now.
    syncPush(AUDIENCE).finally(() => getPushState().then(setPushState))

    const source = new EventSource('/api/v1/notifications/stream?audience=STAFF')
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

  useEffect(() => {
    if (!open) return undefined
    const onClick = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

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

  function toggleSound() {
    const next = !sound
    setSound(next)
    try { window.localStorage.setItem(SOUND_KEY, next ? 'on' : 'off') } catch { /* storage unavailable */ }
    if (next) chime()
  }

  function openItem(item) {
    setOpen(false)
    if (!item.readAt) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry))
      setUnread((count) => Math.max(0, count - 1))
      api(`/notifications/${item.id}/read`, { method: 'PATCH', body: {} }).catch(() => {})
    }
    if (item.orderId) onOpen(item)
  }

  function markAll() {
    setItems((current) => current.map((entry) => entry.readAt ? entry : { ...entry, readAt: new Date().toISOString() }))
    setUnread(0)
    api('/notifications/read-all?audience=STAFF', { method: 'PATCH', body: {} }).catch(() => {})
  }

  return (
    <div className="bell" ref={rootRef}>
      <button className={`icon-btn bell-btn${unread ? ' has-unread' : ''}`} onClick={() => setOpen((value) => !value)} aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Icon name="bell" size={19} />
        {unread > 0 && <span className="bell-count" key={unread}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            <span className="bell-tools">
              <button className="icon-btn" onClick={toggleSound} title={sound ? 'Mute new-order chime' : 'Turn chime on'} aria-label={sound ? 'Mute chime' : 'Turn chime on'}><Icon name={sound ? 'volume' : 'mute'} size={17} /></button>
              {unread > 0 && <button className="text-btn" onClick={markAll}>Mark all read</button>}
            </span>
          </div>
          <PushToggle state={pushState} busy={pushBusy} onToggle={togglePush} />
          <div className="bell-list">
            {items.length === 0 ? (
              <p className="bell-empty">New orders, cooking reminders and customer changes will show up here.</p>
            ) : items.map((item) => (
              <button key={item.id} className={`bell-item${item.readAt ? '' : ' unread'}`} onClick={() => openItem(item)}>
                <span className="bell-icon"><Icon name={ICONS[item.type] ?? 'receipt'} size={16} /></span>
                <span className="bell-text"><strong>{item.title}</strong><span>{item.body}</span><small>{ago(item.createdAt)}</small></span>
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
