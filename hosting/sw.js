// TESTPAD STUDIO — сервис-воркер для push-уведомлений (теги, звонки).
// Сервер шлёт «пустой» push, а текст воркер забирает сам через api.php?r=notify (action=pending).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

async function pending() {
  try {
    const sub = await self.registration.pushManager.getSubscription();
    if (!sub) return [];
    const r = await fetch(new URL('api.php?r=notify', self.registration.scope), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pending', endpoint: sub.endpoint })
    });
    const d = await r.json();
    return d.items || [];
  } catch (e) { return []; }
}

self.addEventListener('push', e => {
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const seen = wins.some(c => c.visibilityState === 'visible');   // сайт открыт и виден — покажем тихо и уберём
    let items = await pending();
    if (!items.length) items = [{ id: 'tp-generic', title: 'TESTPAD STUDIO', body: 'Есть новое уведомление', url: '', type: '' }];
    for (const n of items) {
      const urgent = n.type === 'call' || n.type === 'room';
      await self.registration.showNotification(n.title, {
        body: n.body, tag: n.id, renotify: true, silent: seen,
        icon: 'icon-192.png', badge: 'icon-192.png', vibrate: urgent ? [300, 150, 300, 150, 300] : [200, 100, 200],
        requireInteraction: urgent && !seen, data: { url: n.url || '' }
      });
    }
    if (seen) {
      await new Promise(r => setTimeout(r, 3500));
      for (const n of items) (await self.registration.getNotifications({ tag: n.id })).forEach(x => x.close());
    }
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if ('focus' in c) { await c.focus(); c.postMessage({ type: 'tp-nav', url }); return; }
    }
    await self.clients.openWindow(new URL(url ? '?go=' + url : './', self.registration.scope).href);
  })());
});
