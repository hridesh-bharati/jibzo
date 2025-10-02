import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from './firebaseConfig';
import { ref, set, onValue, off } from 'firebase/database';
import { db } from './firebaseConfig';

export class FCMService {
  static async getFCMToken(userId) {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });
        
        if (token) {
          // Save token to database
          await set(ref(db, `fcmTokens/${userId}`), {
            token,
            createdAt: Date.now()
          });
          return token;
        }
      }
      return null;
    } catch (error) {
      console.error('FCM Token error:', error);
      return null;
    }
  }

  static setupMessageHandler(callback) {
    return onMessage(messaging, (payload) => {
      callback(payload);
      
      // Show browser notification
      if (payload.notification) {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: '/icon.png',
          badge: '/badge.png'
        });
      }
    });
  }

  static async removeFCMToken(userId) {
    try {
      await set(ref(db, `fcmTokens/${userId}`), null);
    } catch (error) {
      console.error('Remove FCM token error:', error);
    }
  }
}