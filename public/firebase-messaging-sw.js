// firebase-messaging-sw.js

// Import Firebase scripts using importScripts
importScripts('https://www.gstatic.com/firebasejs/9.24.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.24.0/firebase-messaging-compat.js');

// ---------------- Firebase Config ----------------
const firebaseConfig = {
  apiKey: "AIzaSyBmnp_8dW9hJ23ZSUFnadB4NHw-89MfN_k",
  authDomain: "portfolio-dfe5c.firebaseapp.com",
  projectId: "portfolio-dfe5c",
  storageBucket: "portfolio-dfe5c.appspot.com",
  messagingSenderId: "1001469015630",
  appId: "1:1001469015630:web:79fe0cfb9ffe9f0a60b51f",
  measurementId: "G-4ZXSHCYXRF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
