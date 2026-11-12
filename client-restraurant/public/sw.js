// Service worker: shows web push notifications and opens the right page when tapped.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Update', body: event.data?.text() } }

  event.waitUntil((async () => {
    // A focused window already shows the update in-page, so don't double up.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (windows.some((client) => client.focused)) return
    await self.registration.showNotification(data.title || 'Update', {
      body: data.body || '',
      tag: data.tag,
      data: { url: data.url || '/' },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        return 'navigate' in client ? client.navigate(url) : undefined
      }
    }
    return self.clients.openWindow(url)
  })())
})
