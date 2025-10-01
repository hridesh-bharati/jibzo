// public/sw.js
const CACHE_NAME = 'jibzo-v2.0';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/logo.png',
  '/icons/logo.png'
];

self.addEventListener('install', (event) => {
  console.log('🟢 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🟢 Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache me mila toh return karo, nahi toh network se fetch karo
        return response || fetch(event.request);
      })
  );
});

// Firebase Messaging ko handle karo
self.addEventListener('push', (event) => {
  console.log('📱 Push event received:', event);
  
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/logo.png',
    badge: '/icons/logo.png',
    image: data.image,
    data: data,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Jibzo', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Pehle check karo koi existing tab hai kya
        for (const client of clientList) {
          if (client.url.includes('jibzo') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Agar nahi hai toh naya tab kholo
        if (clients.openWindow) {
          const urlToOpen = event.notification.data?.url || '/';
          return clients.openWindow(urlToOpen);
        }
      })
  );
});