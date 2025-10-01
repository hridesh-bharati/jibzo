// public/sw.js - COMBINED SERVICE WORKER
const CACHE_NAME = 'jibzo-v3.0';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/logo.png',
  '/icons/logo.png',
  '/manifest.json'
];

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBmnp_8dW9hJ23ZSUFnadB4NHw-89MfN_k",
  authDomain: "portfolio-dfe5c.firebaseapp.com",
  projectId: "portfolio-dfe5c",
  storageBucket: "portfolio-dfe5c.appspot.com",
  messagingSenderId: "1001469015630",
  appId: "1:1001469015630:web:79fe0cfb9ffe9f0a60b51f"
};

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
        return response || fetch(event.request);
      })
  );
});

// ✅ ENHANCED PUSH NOTIFICATION HANDLER
self.addEventListener('push', (event) => {
  console.log('📱 Push event received:', event);
  
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = {
      notification: {
        title: 'Jibzo',
        body: 'You have a new message'
      },
      data: {}
    };
  }

  // 🚨 IMPORTANT: Don't show notification if it's from current user
  if (data.data?.fromId === data.data?.currentUserId) {
    console.log('🚫 Skipping self notification in SW');
    return;
  }

  const options = {
    body: data.notification?.body || 'You have a new message',
    icon: '/icons/logo.png',
    badge: '/icons/logo.png',
    image: data.notification?.image,
    data: data.data || {},
    tag: 'jibzo-' + Date.now(),
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

  console.log('🔄 Showing notification from service worker...');

  event.waitUntil(
    self.registration.showNotification(
      data.notification?.title || 'Jibzo',
      options
    )
  );
});

// ✅ ENHANCED NOTIFICATION CLICK HANDLER
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/messages';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      console.log('🔍 Found clients:', clientList.length);

      // Pehle check karo koi existing tab hai kya
      for (const client of clientList) {
        if (client.url.includes('jibzo') && 'focus' in client) {
          console.log('✅ Focusing existing tab');
          return client.focus();
        }
      }

      // Agar nahi hai toh naya tab kholo
      if (clients.openWindow) {
        console.log('🆕 Opening new tab:', urlToOpen);
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ✅ IMPORT FIREBASE SCRIPTS FOR MESSAGING
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ✅ BACKGROUND MESSAGE HANDLER
messaging.onBackgroundMessage((payload) => {
  console.log('📱 [SW] Received background message:', payload);

  // 🚨 IMPORTANT: Don't show notification if it's from current user
  if (payload.data?.fromId === payload.data?.currentUserId) {
    console.log('🚫 Skipping self background notification');
    return;
  }

  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: '/icons/logo.png',
    badge: '/icons/logo.png',
    image: payload.notification?.image,
    data: payload.data || {},
    tag: 'jibzo-bg-' + Date.now(),
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

  console.log('🔄 Showing background notification...');

  return self.registration.showNotification(
    payload.notification?.title || 'Jibzo',
    notificationOptions
  );
});