import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, update } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

// Firebase Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

// Messaging instance
let messaging = null;

// Get Firebase Messaging instance
export const getFirebaseMessaging = async () => {
  if (!messaging) {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      console.log('✅ Firebase Messaging initialized');
    } else {
      console.log('❌ Firebase Messaging not supported in this environment');
    }
  }
  return messaging;
};

// Request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  try {
    console.log('🔔 Requesting notification permission...');

    // Check browser support
    if (!("Notification" in window)) {
      console.log("❌ This browser does not support notifications");
      throw new Error("Notifications not supported");
    }

    // Check current permission
    let permission = Notification.permission;

    if (permission === "default") {
      console.log('🟡 Requesting notification permission from user...');
      permission = await Notification.requestPermission();
    }

    console.log('📋 Notification permission:', permission);

    if (permission !== "granted") {
      throw new Error("Notification permission denied");
    }

    // Get messaging instance
    const messagingInstance = await getFirebaseMessaging();
    if (!messagingInstance) {
      throw new Error("Messaging not available");
    }

    // Get FCM token with VAPID key
    const token = await getToken(messagingInstance, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });

    if (!token) {
      throw new Error("No token received");
    }

    console.log('✅ FCM Token received:', token);

    // Save token to database
    const currentUser = auth.currentUser;
    if (currentUser) {
      await set(ref(db, `users/${currentUser.uid}/fcmToken`), token);
      console.log('💾 FCM token saved to database');
      
      // Also store in localStorage for quick access
      localStorage.setItem('fcmToken', token);
    }

    return token;
  } catch (error) {
    console.error("❌ Error in requestNotificationPermission:", error);
    
    // Store permission denial in localStorage
    if (error.message.includes("denied")) {
      localStorage.setItem('notificationPermission', 'denied');
    }
    
    throw error;
  }
};

// Handle foreground messages
export const onForegroundMessage = async (callback) => {
  try {
    const messagingInstance = await getFirebaseMessaging();
    
    if (!messagingInstance) {
      console.log('❌ Messaging not available for foreground messages');
      return null;
    }

    return onMessage(messagingInstance, (payload) => {
      console.log('📱 Foreground message received:', payload);
      
      // Call provided callback
      if (callback && typeof callback === 'function') {
        callback(payload);
      }
      
      // Show browser notification
      showBrowserNotification(payload);
    });
  } catch (error) {
    console.error('❌ Error setting up foreground messages:', error);
    return null;
  }
};

// Show browser notification
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
      },
      {
        action: 'close',
        title: '❌ Close'
      }
    ]
  };

  // Only show notification if app is not focused
  if (document.hidden || !document.hasFocus()) {
    const notification = new Notification(title, notificationOptions);

    notification.onclick = (event) => {
      event.preventDefault();
      console.log('🔔 Notification clicked');
      
      notification.close();
      window.focus();

      // Navigate to specific URL if provided
      if (data.url) {
        window.location.href = data.url;
      } else if (data.chatId) {
        window.location.href = `/messages/${data.chatId}`;
      }
    };

    // Auto close after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);

    console.log('✅ Browser notification shown');
  } else {
    console.log('ℹ️ App is focused, notification not shown');
  }
};

// Remove FCM token (on logout)
export const removeFCMToken = async (userId) => {
  if (!userId) {
    console.log('❌ No user ID provided for token removal');
    return;
  }
  
  try {
    await set(ref(db, `users/${userId}/fcmToken`), null);
    localStorage.removeItem('fcmToken');
    console.log('🗑️ FCM token removed for user:', userId);
  } catch (error) {
    console.error('❌ Error removing FCM token:', error);
  }
};

// Check notification status
export const checkNotificationStatus = () => {
  const status = {
    supported: 'Notification' in window,
    permission: Notification.permission,
    serviceWorker: 'serviceWorker' in navigator,
    currentToken: localStorage.getItem('fcmToken')
  };
  
  console.log('🔍 Notification Status:', status);
  return status;
};

// Set auth persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('✅ Auth persistence set to local');
  })
  .catch((error) => {
    console.error("❌ Auth persistence error:", error);
  });

export { 
  app, 
  db, 
  storage, 
  auth, 
  firestore, 
  ref, 
  set, 
  get, 
  update 
};