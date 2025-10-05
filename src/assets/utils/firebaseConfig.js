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

const initializeMessaging = async () => {
  if (!messaging && "Notification" in window) {
    try {
      messaging = getMessaging(app);
      
      // Request permission and get token
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted.');
        
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FCM_VAPID_KEY
        });
        
        if (token) {
          console.log('FCM token:', token);
          return token;
        }
      }
    } catch (error) {
      console.error('Error initializing messaging:', error);
    }
  }
  return null;
};

// FCM Token get करने का function
const getFCMToken = async () => {
  try {
    const token = await initializeMessaging();
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Foreground messages handle करें
const onMessageListener = () => {
  return new Promise((resolve) => {
    if (messaging) {
      onMessage(messaging, (payload) => {
        console.log('Message received in foreground:', payload);
        resolve(payload);
      });
    }
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
  getFCMToken,
  onMessageListener
};