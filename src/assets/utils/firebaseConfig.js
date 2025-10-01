// src/assets/utils/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

// Messaging with better error handling
let messaging = null;

export const getFirebaseMessaging = async () => {
  if (!messaging && await isSupported()) {
    messaging = getMessaging(app);
  }
  return messaging;
};

// Request notification permission and get token
export const requestNotificationPermission = async () => {
  try {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const messagingInstance = await getFirebaseMessaging();
      if (!messagingInstance) return null;
      
      const token = await getToken(messagingInstance, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });
      console.log("FCM Token received:", token);
      return token;
    }
    return null;
  } catch (error) {
    console.error("Error getting notification token:", error);
    return null;
  }
};

// Handle foreground messages
export const onForegroundMessage = (callback) => {
  return getFirebaseMessaging().then(messagingInstance => {
    if (!messagingInstance) return null;
    
    return onMessage(messagingInstance, (payload) => {
      console.log("Foreground message received:", payload);
      if (callback) callback(payload);
      showBrowserNotification(payload);
    });
  });
};

// Browser notification helper
export const showBrowserNotification = (payload) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const { title, body, image } = payload.notification || payload.data || {};

  const notificationOptions = {
    body: body || "New message received",
    icon: "/logo.png",
    image: image,
    badge: "/logo.png",
    tag: "chat-message",
    renotify: true,
    silent: false,
    data: payload.data || {},
    actions: [
      {
        action: "open",
        title: "Open Chat",
      },
    ],
  };

  // Show notification only if app is not focused
  if (document.hidden || !document.hasFocus()) {
    const notification = new Notification(title || "New Message", notificationOptions);

    notification.onclick = () => {
      window.focus();
      notification.close();

      if (payload.data?.url) {
        window.location.href = payload.data.url;
      }
    };

    // Auto close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
  }
};

// Auth persistence
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.error("Auth persistence error:", err)
);

export { app, db, storage, auth, firestore, ref, set, get };