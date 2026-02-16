self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : { title: 'QR Bell', body: 'Someone is at your door' };

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    requireInteraction: true,
    tag: 'qr-bell-ring',
    data: payload.data ?? {},
    actions: [
      { action: 'answer', title: 'Answer' },
      { action: 'ignore', title: 'Ignore' }
    ]
  };

  event.waitUntil(self.registration.showNotification(payload.title ?? 'QR Bell', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'answer') {
    event.waitUntil(clients.openWindow('/call'));
  }
});
