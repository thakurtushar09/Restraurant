import { api } from './lib.js'

// Web push for this device. States: 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'.

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration('/')
  return registration ? registration.pushManager.getSubscription() : null
}

export async function getPushState() {
  // iPhone/iPad only allow web push for sites added to the Home Screen.
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

async function saveSubscription(subscription, audience) {
  await api('/notifications/push/subscribe', { method: 'POST', body: { audience, subscription: subscription.toJSON() } })
}

export async function enablePush(audience) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  const { publicKey } = await api('/notifications/push/public-key')
  const subscription = (await registration.pushManager.getSubscription())
    ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
  await saveSubscription(subscription, audience)
  return 'on'
}

export async function disablePush() {
  const subscription = supported() ? await currentSubscription() : null
  if (!subscription) return 'off'
  await api('/notifications/push/unsubscribe', { method: 'POST', body: { endpoint: subscription.endpoint } }).catch(() => {})
  await subscription.unsubscribe()
  return 'off'
}

// After sign-in, re-link an existing subscription to whoever is signed in now.
export async function syncPush(audience) {
  if (!supported() || Notification.permission !== 'granted') return
  const subscription = await currentSubscription()
  if (subscription) await saveSubscription(subscription, audience).catch(() => {})
}
