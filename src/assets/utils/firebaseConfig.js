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

    try {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
      console.log('🔑 FCM Token:', token);
    } catch (error) {
      console.error('❌ FCM Token error:', error);
    }
  }
  return messaging;
};

export const requestNotificationPermission = async () => {
  try {
    console.log('🔔 Requesting notification permission...');

    if (!("Notification" in window)) {
      console.log("❌ This browser does not support notifications");
      return null;
    }

    let permission = Notification.permission;

    if (permission === "default") {
      console.log('🟡 Requesting notification permission...');
      permission = await Notification.requestPermission();
    }

    console.log('📋 Notification permission:', permission);

    if (permission === "granted") {
      const messagingInstance = await getFirebaseMessaging();
      if (!messagingInstance) {
        console.log('❌ Messaging not supported');
        return null;
      }

      try {
        // ✅ VAPID KEY USE KARO YAHAN
        const token = await getToken(messagingInstance, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY // YEH LINE IMPORTANT HAI
        });

        console.log('✅ FCM Token with VAPID received:', token);

        if (token) {
          // Token save karo database mein
          const currentUser = auth.currentUser;
          if (currentUser) {
            await set(ref(db, `users/${currentUser.uid}/fcmToken`), token);
            console.log('💾 FCM token saved to database');
          }
        }

        return token;
      } catch (tokenError) {
        console.error('❌ Error getting FCM token:', tokenError);
        return null;
      }
    } else {
      console.log('❌ Notification permission not granted');
      return null;
    }
  } catch (error) {
    console.error("❌ Error requesting notification permission:", error);
    return null;
  }
};

// Handle foreground messages
export const onForegroundMessage = (callback) => {
  return getFirebaseMessaging().then(messagingInstance => {
    if (!messagingInstance) {
      console.log('❌ Messaging not available for foreground messages');
      return null;
    }

    return onMessage(messagingInstance, (payload) => {
      console.log('📱 Foreground message received:', payload);

      // Custom notification show karo
      if (callback) {
        callback(payload);
      }

      // Browser notification bhi show karo
      showBrowserNotification(payload);
    });
  });
};

// Enhanced browser notification
export const showBrowserNotification = (payload) => {
  if (!("Notification" in window)) {
    console.log("❌ Browser doesn't support notifications");
    return;
  }

  if (Notification.permission !== "granted") {
    console.log("❌ Notification permission not granted");
    return;
  }

  const title = payload.notification?.title || 'Jibzo';
  const body = payload.notification?.body || 'You have a new message';
  const image = payload.notification?.image;
  const data = payload.data || {};

  const notificationOptions = {
    body: body,
    icon: '/icons/logo.png',
    badge: '/icons/logo.png',
    image: image,
    data: data,
    tag: 'jibzo-message',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: '💬 Open Chat'
      }
    ]
  };

  // Only show if app is not focused
  if (document.hidden || !document.hasFocus()) {
    const notification = new Notification(title, notificationOptions);

    notification.onclick = () => {
      console.log('🔔 Notification clicked');
      window.focus();
      notification.close();

      // Specific URL par navigate karo
      if (data.url) {
        window.location.href = data.url;
      }
    };

    // Auto close after 8 seconds
    setTimeout(() => {
      notification.close();
    }, 8000);

    console.log('✅ Browser notification shown');
  } else {
    console.log('ℹ️ App is focused, notification not shown');
  }
};

// Auth persistence
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.error("Auth persistence error:", err)
);

export { app, db, storage, auth, firestore, ref, set, get };