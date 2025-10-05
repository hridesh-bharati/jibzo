import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

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

// Messaging functions
let messaging = null;

const getFirebaseMessaging = async () => {
  if (!messaging && "Notification" in window) {
    try {
      messaging = getMessaging(app);
    } catch (error) {
      console.error('Messaging initialization error:', error);
    }
  }
  return messaging;
};

// FCM Token get करने का function
const getFCMToken = async () => {
  try {
    const messagingInstance = await getFirebaseMessaging();
    if (!messagingInstance) return null;

    const currentToken = await getToken(messagingInstance, { 
      vapidKey: import.meta.env.VITE_FCM_VAPID_KEY 
    });
    
    if (currentToken) {
      console.log('FCM Token:', currentToken);
      return currentToken;
    } else {
      console.log('No registration token available.');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Foreground messages handle करें
const onMessageListener = () => {
  return new Promise((resolve) => {
    getFirebaseMessaging().then(messagingInstance => {
      if (messagingInstance) {
        onMessage(messagingInstance, (payload) => {
          console.log('Message received in foreground:', payload);
          resolve(payload);
        });
      }
    });
  });
};

// Auth persistence
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.error("Auth persistence error:", err)
);

export { 
  app, 
  db, 
  storage, 
  auth, 
  firestore, 
  ref, 
  set, 
  get,
  getFirebaseMessaging,
  getFCMToken,
  onMessageListener
};