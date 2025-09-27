// src/utils/fcmClient.js
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app } from "./firebaseConfig";

let messaging = null;
let currentToken = null;

// Check if running in a supported environment
const isClientSide = typeof window !== 'undefined';

export const initializeFCM = async () => {
  if (!isClientSide) return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("FCM not supported in this browser");
      return null;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn("Service Worker not supported");
      return null;
    }

    if (!("Notification" in window)) {
      console.warn("Notifications not supported");
      return null;
    }

    return true;
  } catch (error) {
    console.error("FCM initialization error:", error);
    return null;
  }
};

export const requestFcmToken = async () => {
  if (!isClientSide) return null;

  try {
    // Check if already have token
    if (currentToken) {
      console.log("Using cached FCM token");
      return currentToken;
    }

    const initialized = await initializeFCM();
    if (!initialized) return null;

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied");
      return null;
    }

    messaging = getMessaging(app);

    // Use ONLY Firebase Messaging service worker
    let serviceWorkerRegistration;
    try {
      serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      console.log("✅ Firebase Messaging Service Worker registered");
    } catch (error) {
      console.error("Failed to register FCM service worker:", error);
      return null;
    }

    // Wait for service worker to be ready
    await serviceWorkerRegistration.ready;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error("VAPID key missing");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: serviceWorkerRegistration,
    });

    if (!token) {
      throw new Error("No token received from FCM");
    }

    console.log("✅ FCM Token obtained:", token.substring(0, 20) + "...");
    currentToken = token;
    return token;

  } catch (error) {
    console.error("❌ Error getting FCM token:", error);
    currentToken = null;
    return null;
  }
};

export const onForegroundMessage = (callback) => {
  if (!isClientSide) return () => {};

  const setupListener = async () => {
    try {
      if (!messaging) {
        messaging = getMessaging(app);
      }

      return onMessage(messaging, callback);
    } catch (error) {
      console.error("Error setting up message listener:", error);
    }
  };

  setupListener();
  return () => {}; // Cleanup function
};

export const showLocalNotification = (title, options = {}) => {
  if (!isClientSide) return;

  if (Notification.permission === "granted") {
    const notificationOptions = {
      icon: options.icon || '/logo.png',
      badge: options.badge || '/logo.png',
      body: options.body,
      tag: options.tag || 'general',
      ...options
    };

    new Notification(title, notificationOptions);
  }
};

// Save token to your backend
export const saveFcmTokenToBackend = async (userId, token) => {
  try {
    const response = await fetch('/api/saveAndPush', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        token: token,
        title: 'Device Registered',
        body: 'Your device is ready to receive notifications'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Token saved to backend:", result);
    return result;
  } catch (error) {
    console.error("❌ Failed to save token to backend:", error);
    throw error;
  }
};