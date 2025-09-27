// src/utils/fcmClient.js
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app } from "./firebaseConfig";

let messaging = null;

// Check if running in a supported environment (browser, not SSR)
const isClientSide = typeof window !== 'undefined';

export const initializeFCM = async () => {
  // Skip if not in browser environment (SSR safety)
  if (!isClientSide) {
    return null;
  }

  try {
    const supported = await isSupported();
    
    if (!supported) {
      console.warn("🔥 FCM is not supported in this browser.");
      return null;
    }

    // Check for service worker support
    if (!('serviceWorker' in navigator)) {
      console.warn("🔕 Service Worker not supported");
      return null;
    }

    if (!("Notification" in window)) {
      console.warn("🔕 Notifications not supported by browser");
      return null;
    }

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("❌ Notifications not allowed by user");
      return null;
    }

    return true;
  } catch (error) {
    console.error("❌ Error initializing FCM:", error);
    return null;
  }
};

export const requestFcmToken = async () => {
  // Skip if not in browser environment
  if (!isClientSide) {
    return null;
  }

  try {
    // Initialize FCM first
    const initialized = await initializeFCM();
    if (!initialized) {
      return null;
    }

    messaging = getMessaging(app);

    // Check if VAPID key is available
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error("❌ VAPID key not found in environment variables");
      return null;
    }

    // Register service worker with error handling
    let serviceWorkerRegistration;
    try {
      serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/"
      });
      console.log("✅ Service Worker registered successfully");
    } catch (swError) {
      console.warn("⚠️ Custom service worker registration failed, using default:", swError);
      
      // Try to use existing service worker
      serviceWorkerRegistration = await navigator.serviceWorker.ready;
    }

    const token = await getToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: serviceWorkerRegistration,
    });

    if (!token) {
      console.warn("❌ No FCM token received");
      return null;
    }

    console.log("✅ FCM Token obtained successfully");
    return token;
  } catch (error) {
    console.error("❌ Error getting FCM token:", error);
    
    // More specific error handling
    if (error.code === 'messaging/failed-service-worker-registration') {
      console.error("Service Worker registration failed - check file path and scope");
    } else if (error.code === 'messaging/invalid-vapid-key') {
      console.error("Invalid VAPID key - check environment variable");
    }
    
    return null;
  }
};

export const onForegroundMessage = (callback) => {
  // Skip if not in browser environment
  if (!isClientSide) {
    return () => {}; // Return empty cleanup function
  }

  const setupForegroundListener = async () => {
    try {
      const supported = await isSupported();
      if (!supported) return;

      if (!messaging) {
        messaging = getMessaging(app);
      }

      return onMessage(messaging, callback);
    } catch (error) {
      console.error("❌ Error setting up foreground message listener:", error);
    }
  };

  // Setup listener and return cleanup function
  let unsubscribe;
  setupForegroundListener().then(unsub => {
    unsubscribe = unsub;
  });

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
};

// Utility function to check FCM support
export const checkFcmSupport = async () => {
  if (!isClientSide) return false;
  
  try {
    const supported = await isSupported();
    if (!supported) return false;

    if (!('serviceWorker' in navigator)) return false;
    if (!('Notification' in window)) return false;

    return true;
  } catch (error) {
    return false;
  }
};

// Function to manually show local notification
export const showLocalNotification = (title, options = {}) => {
  if (!isClientSide) return;

  if ('Notification' in window && Notification.permission === 'granted') {
    const notificationOptions = {
      icon: options.icon || '/logo.png',
      badge: options.badge || '/logo.png',
      image: options.image,
      body: options.body,
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
      ...options
    };

    new Notification(title, notificationOptions);
  }
};