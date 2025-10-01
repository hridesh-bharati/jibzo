// src\assets\utils\notificationService.js
import { db } from './firebaseConfig';
import { ref as dbRef, set, onValue, off, update, get } from 'firebase/database';

export class NotificationService {
  constructor(currentUid) {
    this.currentUid = currentUid;
    this.unsubscribe = null;
  }

  // Listen for new notifications
  listenForNotifications(callback) {
    if (!this.currentUid) return;

    const notificationsRef = dbRef(db, `notifications/${this.currentUid}`);
    
    this.unsubscribe = onValue(notificationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const notifications = Object.entries(snapshot.val())
          .map(([id, data]) => ({
            id,
            ...data
          }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Get only unseen notifications
        const newNotifications = notifications.filter(n => !n.seen);
        if (newNotifications.length > 0) {
          callback(newNotifications);
        }
      }
    });
  }

  // Mark notification as seen
  async markAsSeen(notificationId) {
    await set(dbRef(db, `notifications/${this.currentUid}/${notificationId}/seen`), true);
  }

  // Mark all as seen
  async markAllAsSeen() {
    const notificationsRef = dbRef(db, `notifications/${this.currentUid}`);
    const snapshot = await get(notificationsRef);
    if (snapshot.exists()) {
      const updates = {};
      Object.keys(snapshot.val()).forEach(id => {
        updates[`${id}/seen`] = true;
      });
      await update(dbRef(db, `notifications/${this.currentUid}`), updates);
    }
  }

  unsubscribeFromNotifications() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Check and request notification permission
export const initializeNotifications = async (currentUid) => {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return null;
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted');
      return new NotificationService(currentUid);
    }
  } else if (Notification.permission === 'granted') {
    return new NotificationService(currentUid);
  }
  
  return null;
};

// Save FCM token to user profile
export const saveFCMToken = async (userId, token) => {
  if (!userId || !token) return;
  try {
    await set(dbRef(db, `users/${userId}/fcmToken`), token);
    console.log('FCM token saved for user:', userId);
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
};