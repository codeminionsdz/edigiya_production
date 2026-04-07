// public/service-worker.js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Notification';
  const options = {
    body: data.body,
    icon: '/brand/logo.jpg',
    badge: '/brand/logo.jpg',
    tag: data.tag || 'notification',
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab with the target URL
      if (event.notification.data.url && clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
