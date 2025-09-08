import { getFirebaseMessaging } from './firebaseConfig';
import { getToken, onMessage } from "firebase/messaging";

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export const requestForToken = async () => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  try {
    const currentToken = await getToken(messaging, { vapidKey });
    return currentToken || null;
  } catch (error) {
    console.error("Error getting token:", error);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    getFirebaseMessaging().then((messaging) => {
      if (!messaging) return;
      onMessage(messaging, (payload) => {
        resolve(payload);
      });
    });
  });
