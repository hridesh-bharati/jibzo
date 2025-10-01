// src/assets/utils/notificationService.js
import { db } from './firebaseConfig';
import { ref as dbRef, set, onValue, off, update, get, push } from 'firebase/database';

export class NotificationService {
  constructor(currentUid) {
    this.currentUid = currentUid;
    this.unsubscribe = null;
  }

  // Listen for new notifications
  listenForNotifications(callback) {
    if (!this.currentUid) {
      console.log('❌ No current user ID for notifications');
      return;
    }

    console.log('👂 Listening for notifications for user:', this.currentUid);
    
    const notificationsRef = dbRef(db, `notifications/${this.currentUid}`);
    
    this.unsubscribe = onValue(notificationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const notifications = Object.entries(snapshot.val())
          .map(([id, data]) => ({
            id,
            ...data
          }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        console.log('📨 Notifications found:', notifications.length);
        
        // Get only unseen notifications
        const newNotifications = notifications.filter(n => !n.seen);
        
        if (newNotifications.length > 0) {
          console.log('🆕 New notifications:', newNotifications.length);
          callback(newNotifications);
        }
      } else {
        console.log('ℹ️ No notifications found');
      }
    }, (error) => {
      console.error('❌ Error listening to notifications:', error);
    });
  }

  // Mark notification as seen
  async markAsSeen(notificationId) {
    try {
      await set(dbRef(db, `notifications/${this.currentUid}/${notificationId}/seen`), true);
      console.log('✅ Notification marked as seen:', notificationId);
    } catch (error) {
      console.error('❌ Error marking notification as seen:', error);
    }
  }

  // Mark all as seen
  async markAllAsSeen() {
    try {
      const notificationsRef = dbRef(db, `notifications/${this.currentUid}`);
      const snapshot = await get(notificationsRef);
      
      if (snapshot.exists()) {
        const updates = {};
        Object.keys(snapshot.val()).forEach(id => {
          updates[`${id}/seen`] = true;
        });
        
        await update(dbRef(db, `notifications/${this.currentUid}`), updates);
        console.log('✅ All notifications marked as seen');
      }
    } catch (error) {
      console.error('❌ Error marking all notifications as seen:', error);
    }
  }

  // Create a new notification
  async createNotification(notificationData) {
    try {
      const notifRef = push(dbRef(db, `notifications/${this.currentUid}`));
      await set(notifRef, {
        ...notificationData,
        timestamp: Date.now(),
        seen: false
      });
      
      console.log('✅ Notification created:', notificationData);
      return notifRef.key;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      return null;
    }
  }

  unsubscribeFromNotifications() {
    if (this.unsubscribe) {
      this.unsubscribe();
      console.log('🔇 Unsubscribed from notifications');
    }
  }
}

// Check and request notification permission
export const initializeNotifications = async (currentUid) => {
  console.log('🔄 Initializing notifications for user:', currentUid);
  
  if (!("Notification" in window)) {
    console.log("❌ This browser does not support notifications");
    return null;
  }

  try {
    let permission = Notification.permission;
    
    if (permission === 'default') {
      console.log('🟡 Requesting notification permission...');
      permission = await Notification.requestPermission();
      console.log('📋 Permission result:', permission);
    }

    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      return new NotificationService(currentUid);
    } else {
      console.log('❌ Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('❌ Error initializing notifications:', error);
    return null;
  }
};

// Save FCM token to user profile
export const saveFCMToken = async (userId, token) => {
  if (!userId || !token) {
    console.log('❌ Invalid user ID or token');
    return;
  }
  
  try {
    await set(dbRef(db, `users/${userId}/fcmToken`), token);
    console.log('💾 FCM token saved for user:', userId);
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
  }
};

// Debug function to check notification status
export const checkNotificationStatus = () => {
  const status = {
    supported: 'Notification' in window,
    permission: Notification.permission,
    serviceWorker: 'serviceWorker' in navigator,
  };
  
  console.log('🔍 Notification Status:', status);
  return status;
};