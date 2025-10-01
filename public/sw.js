

const CACHE_NAME = 'jibzo-v2.1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/logo.png',
  '/icons/logo.png',
  '/manifest.json'
];

// Firebase Messaging Integration
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging-compat.js');

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBmnp_8dW9hJ23ZSUFnadB4NHw-89MfN_k",
  authDomain: "portfolio-dfe5c.firebaseapp.com",
  projectId: "portfolio-dfe5c",
  storageBucket: "portfolio-dfe5c.appspot.com",
  messagingSenderId: "1001469015630",
  appId: "1:1001469015630:web:79fe0cfb9ffe9f0a60b51f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

self.addEventListener('install', (event) => {
  console.log('🟢 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('❌ Cache installation failed:', error);
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
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // Fallback for failed requests
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
});

// Firebase Background Message Handler
messaging.onBackgroundMessage((payload) => {
  console.log('📱 [SW] Received background message:', payload);

  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/icons/logo.png',
    badge: '/icons/logo.png',
    image: payload.notification?.image,
    data: payload.data || {},
    tag: 'jibzo-message',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: '💬 Open Chat'
      },
      {
        action: 'close',
        title: '❌ Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      payload.notification?.title || 'Jibzo',
      notificationOptions
    )
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] Notification clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      console.log('🔍 Found clients:', clientList.length);

      // Focus existing tab
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          console.log('✅ Focusing existing tab');
          return client.focus();
        }
      }

      // Open new tab
      if (clients.openWindow) {
        console.log('🆕 Opening new tab:', urlToOpen);
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Push Event Handler
self.addEventListener('push', (event) => {
  console.log('📬 Push event received:', event);

  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = {
      notification: {
        title: 'Jibzo',
        body: 'You have a new message'
      }
    };
  }

  const options = {
    body: data.notification?.body || 'New notification',
    icon: '/icons/logo.png',
    badge: '/icons/logo.png',
    data: data.data || {},
    tag: 'jibzo-push',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      data.notification?.title || 'Jibzo',
      options
    )
  );
});