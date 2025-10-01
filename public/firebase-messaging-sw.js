// public/firebase-messaging-sw.js - 

importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.0/firebase-messaging-compat.js');

// Firebase Config - APNA ACTUAL CONFIG USE KARO
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

// ✅ ENHANCED BACKGROUND MESSAGE HANDLER
messaging.onBackgroundMessage((payload) => {
  console.log('📱 [SW] Received background message:', payload);

  // Custom notification options
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

  console.log('🔄 Showing notification from service worker...');

  // Show notification
  return self.registration.showNotification(
    payload.notification?.title || 'Jibzo',
    notificationOptions
  );
});

// ✅ IMPROVED NOTIFICATION CLICK HANDLER
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] Notification clicked:', event);
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

// ✅ PUSH EVENT LISTENER (Extra safety)
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
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(
      data.notification?.title || 'Jibzo',
      options
    )
  );
});