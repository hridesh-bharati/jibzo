// src/utils/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, update, remove, push, onValue, off } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot } from "firebase/firestore";
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const db = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

// Initialize messaging with safety check
let messaging = null;

const initializeMessaging = async () => {
  try {
    const isMessagingSupported = await isSupported();
    if (isMessagingSupported) {
      messaging = getMessaging(app);
      console.log('Messaging initialized successfully');
    } else {
      console.log('Messaging not supported in this environment');
    }
  } catch (error) {
    console.warn('Messaging initialization failed:', error);
  }
};

// Initialize messaging immediately
initializeMessaging();

// FCM Token get करने का function
const getFCMToken = async () => {
  try {
    if (!messaging) {
      console.log('Messaging not available');
      return null;
    }

    // Check notification permission
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return null;
    }

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("Notification permission denied");
        return null;
      }
    } else if (Notification.permission !== "granted") {
      console.log("Notification permission not granted");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FCM_VAPID_KEY || "BIt5p8R9L4y9zQYVcT7XqKjZkLmNpOaRsTuVwXyZzAbCdEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWx"
    });

    if (token) {
      console.log("FCM token obtained successfully");
      return token;
    } else {
      console.log("No registration token available");
      return null;
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
};

// Foreground messages handle करें
const onMessageListener = () => {
  return new Promise((resolve, reject) => {
    if (!messaging) {
      reject(new Error("Messaging not available"));
      return;
    }

    try {
      onMessage(messaging, (payload) => {
        console.log("Message received in foreground:", payload);
        resolve(payload);
      });
    } catch (error) {
      reject(error);
    }
  });
};

// Register Service Worker
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registered successfully:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  } else {
    console.log('Service Workers are not supported in this browser');
    return null;
  }
};

// Request notification permission
const requestNotificationPermission = async () => {
  try {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Notification permission granted");
      return true;
    } else {
      console.log("Notification permission denied");
      return false;
    }
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
};

// Initialize notifications (call this when app starts)
const initializeNotifications = async () => {
  try {
    // Register service worker first
    await registerServiceWorker();
    
    // Request permission
    const hasPermission = await requestNotificationPermission();
    
    if (hasPermission) {
      // Get FCM token
      const token = await getFCMToken();
      return token;
    }
    
    return null;
  } catch (error) {
    console.error("Error initializing notifications:", error);
    return null;
  }
};

// Auth persistence
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.error("Auth persistence error:", err)
);

// Export everything
export { 
  // Firebase instances
  app, 
  db, 
  storage, 
  auth, 
  firestore, 
  messaging,
  
  // Realtime Database functions
  ref, 
  set, 
  get,
  update,
  remove,
  push,
  onValue,
  off,
  
  // Storage functions
  storageRef as storageRef,
  uploadBytes,
  getDownloadURL,
  
  // Auth functions
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  
  // Firestore functions
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  
  // Messaging functions
  getFCMToken,
  onMessageListener,
  
  // Notification functions
  registerServiceWorker,
  requestNotificationPermission,
  initializeNotifications
};