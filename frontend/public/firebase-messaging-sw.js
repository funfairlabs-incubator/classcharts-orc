// firebase-messaging-sw.js
// This file must be served from the root path (/firebase-messaging-sw.js).
// It is picked up automatically by getToken() in the Firebase SDK.
// Next.js serves everything from /public at the root, so placing it here is correct.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// These values are injected at runtime via the sw-config endpoint, or fall back
// to the __FIREBASE_CONFIG__ placeholder replaced during build if you prefer.
// For simplicity we read them from self.__WB_MANIFEST which next-pwa injects,
// but here we use the simpler approach of a config endpoint.
self.addEventListener('fetch', () => {}); // keep SW active

// Config is fetched once and cached; avoids hard-coding keys in a public file.
let firebaseApp;

async function getConfig() {
  try {
    const res = await fetch('/api/firebase-config');
    return await res.json();
  } catch {
    return null;
  }
}

async function initFirebase() {
  if (firebaseApp) return;
  const config = await getConfig();
  if (!config) return;
  firebaseApp = firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // Handle background messages (app not in foreground)
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification ?? {};
    const url = payload.webpush?.fcmOptions?.link ?? '/';
    if (!title) return;
    self.registration.showNotification(title, {
      body: body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      data: { url },
    });
  });
}

// Notification click — open or focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(initFirebase());
});

initFirebase();
