// public/firebase-messaging-sw.js

// Import Firebase SDK (for service worker)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-messaging-sw.js";

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
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// ---------------- Background Notifications ----------------
onBackgroundMessage(messaging, (payload) => {
  console.log("[firebase-messaging-sw.js] Background message: ", payload);

  const notificationTitle = payload.notification?.title || "New Notification";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/icons/icon-192.png", // must exist in public/icons/
    badge: "/icons/icon-192.png"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ---------------- Notification Click ----------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("/") // Change route if you want specific redirect
  );
});
