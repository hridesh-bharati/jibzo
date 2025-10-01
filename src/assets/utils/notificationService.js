import { db } from './firebaseConfig';
import { ref as dbRef, set, onValue, off, update, get, push, remove } from 'firebase/database';

export class NotificationService {
  constructor(currentUid) {
    this.currentUid = currentUid;
    this.unsubscribe = null;
    this.listeners = new Set();
  }

  // Add notification listener
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove notification listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners(notifications) {
    this.listeners.forEach(callback => {
      try {
        callback(notifications);
      } catch (error) {
        console.error('❌ Notification listener error:', error);
      }
    });
  }

  // Listen for new notifications
  listenForNotifications() {
    if (!this.currentUid) {
      console.log('❌ No current user ID for notifications');
      return;
    }

    console.log('👂 Listening for notifications for user:', this.currentUid);
    
    const notificationsRef = dbRef(db, `notifications/${this.currentUid}`);
    
    this.unsubscribe = onValue(notificationsRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          const notificationsData = snapshot.val();
          const notifications = Object.entries(notificationsData)
            .map(([id, data]) => ({
              id,
              ...data
            }))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          
          console.log('📨 Notifications found:', notifications.length);
          
          // Get unseen notifications
          const newNotifications = notifications.filter(n => !n.seen);
          const allNotifications = notifications;
          
          // Notify listeners
          this.notifyListeners({
            all: allNotifications,
            new: newNotifications,
            total: notifications.length,
            unread: newNotifications.length
          });

        } else {
          console.log('ℹ️ No notifications found');
          this.notifyListeners({
            all: [],
            new: [],
            total: 0,
            unread: 0
          });
        }
      } catch (error) {
        console.error('❌ Error processing notifications:', error);
        this.notifyListeners({
          all: [],
          new: [],
          total: 0,
          unread: 0,
          error: error.message
        });
      }
    }, (error) => {
      console.error('❌ Error listening to notifications:', error);
      this.notifyListeners({
        all: [],
        new: [],
        total: 0,
        unread: 0,
        error: error.message
      });
    });
  }

  // Mark notification as seen
  async markAsSeen(notificationId) {
    if (!this.currentUid || !notificationId) {
      console.log('❌ Missing user ID or notification ID');
      return false;
    }

    try {
      await update(dbRef(db, `notifications/${this.currentUid}/${notificationId}`), {
        seen: true,
        seenAt: Date.now()
      });
      console.log('✅ Notification marked as seen:', notificationId);
      return true;
    } catch (error) {
      console.error('❌ Error marking notification as seen:', error);
      return false;
    }
  }

  // Mark all notifications as seen
  async markAllAsSeen() {
    if (!this.currentUid) {
      console.log('❌ No current user ID');
      return false;
    }

    try {
      const notificationsRef = dbRef(db, `notifications/${this.currentUid}`);
      const snapshot = await get(notificationsRef);
      
      if (snapshot.exists()) {
        const updates = {};
        const notifications = snapshot.val();
        
        Object.keys(notifications).forEach(id => {
          if (!notifications[id].seen) {
            updates[`${id}/seen`] = true;
            updates[`${id}/seenAt`] = Date.now();
          }
        });
        
        if (Object.keys(updates).length > 0) {
          await update(notificationsRef, updates);
          console.log('✅ All notifications marked as seen');
        } else {
          console.log('ℹ️ No unread notifications to mark');
        }
      } else {
        console.log('ℹ️ No notifications found to mark as seen');
      }
      return true;
    } catch (error) {
      console.error('❌ Error marking all notifications as seen:', error);
      return false;
    }
  }

  // Create a new notification
  async createNotification(notificationData) {
    if (!this.currentUid) {
      console.log('❌ No current user ID for creating notification');
      return null;
    }

    try {
      const notifRef = push(dbRef(db, `notifications/${this.currentUid}`));
      const notificationId = notifRef.key;
      
      const completeNotification = {
        ...notificationData,
        id: notificationId,
        timestamp: Date.now(),
        seen: false,
        userId: this.currentUid
      };
      
      await set(notifRef, completeNotification);
      
      console.log('✅ Notification created:', completeNotification);
      return notificationId;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      return null;
    }
  }

  // Delete a notification
  async deleteNotification(notificationId) {
    if (!this.currentUid || !notificationId) {
      console.log('❌ Missing user ID or notification ID');
      return false;
    }

    try {
      await remove(dbRef(db, `notifications/${this.currentUid}/${notificationId}`));
      console.log('🗑️ Notification deleted:', notificationId);
      return true;
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      return false;
    }
  }

  // Clear all notifications
  async clearAllNotifications() {
    if (!this.currentUid) {
      console.log('❌ No current user ID');
      return false;
    }

    try {
      await remove(dbRef(db, `notifications/${this.currentUid}`));
      console.log('🗑️ All notifications cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing all notifications:', error);
      return false;
    }
  }

  // Get notification count
  async getNotificationCount() {
    if (!this.currentUid) {
      return { total: 0, unread: 0 };
    }

    try {
      const snapshot = await get(dbRef(db, `notifications/${this.currentUid}`));
      
      if (snapshot.exists()) {
        const notifications = snapshot.val();
        const notificationArray = Object.values(notifications);
        
        return {
          total: notificationArray.length,
          unread: notificationArray.filter(n => !n.seen).length
        };
      }
      
      return { total: 0, unread: 0 };
    } catch (error) {
      console.error('❌ Error getting notification count:', error);
      return { total: 0, unread: 0, error: error.message };
    }
  }

  // Cleanup
  unsubscribeFromNotifications() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      console.log('🔇 Unsubscribed from notifications');
    }
    
    this.listeners.clear();
  }
}

// Initialize notifications
export const initializeNotifications = async (currentUid) => {
  console.log('🔄 Initializing notifications for user:', currentUid);
  
  if (!currentUid) {
    console.log('❌ No user ID provided for notifications');
    return null;
  }

  // Check browser support
  if (!("Notification" in window)) {
    console.log("❌ This browser does not support notifications");
    return null;
  }

  try {
    // Create notification service instance
    const notificationService = new NotificationService(currentUid);
    
    // Start listening for notifications
    notificationService.listenForNotifications();
    
    console.log('✅ Notifications initialized successfully');
    return notificationService;
  } catch (error) {
    console.error('❌ Error initializing notifications:', error);
    return null;
  }
};

// Check and request notification permission
export const checkAndRequestNotificationPermission = async () => {
  try {
    if (!("Notification" in window)) {
      throw new Error("Notifications not supported");
    }

    let permission = Notification.permission;
    
    if (permission === 'default') {
      console.log('🟡 Requesting notification permission...');
      permission = await Notification.requestPermission();
    }

    console.log('📋 Notification permission:', permission);
    
    const result = {
      granted: permission === 'granted',
      permission: permission,
      supported: true
    };
    
    // Store in localStorage
    localStorage.setItem('notificationPermission', permission);
    
    return result;
  } catch (error) {
    console.error('❌ Error in notification permission check:', error);
    return {
      granted: false,
      permission: Notification.permission,
      supported: 'Notification' in window,
      error: error.message
    };
  }
};

// Save FCM token to user profile
export const saveFCMToken = async (userId, token) => {
  if (!userId || !token) {
    console.log('❌ Invalid user ID or token');
    return false;
  }
  
  try {
    await set(dbRef(db, `users/${userId}/fcmToken`), token);
    localStorage.setItem('fcmToken', token);
    console.log('💾 FCM token saved for user:', userId);
    return true;
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
    return false;
  }
};

// Remove FCM token
export const removeFCMToken = async (userId) => {
  if (!userId) {
    console.log('❌ No user ID provided for token removal');
    return false;
  }
  
  try {
    await set(dbRef(db, `users/${userId}/fcmToken`), null);
    localStorage.removeItem('fcmToken');
    console.log('🗑️ FCM token removed for user:', userId);
    return true;
  } catch (error) {
    console.error('❌ Error removing FCM token:', error);
    return false;
  }
};

// Debug function to check notification status
export const checkNotificationStatus = () => {
  const status = {
    supported: 'Notification' in window,
    permission: Notification.permission,
    serviceWorker: 'serviceWorker' in navigator,
    currentToken: localStorage.getItem('fcmToken'),
    storedPermission: localStorage.getItem('notificationPermission')
  };
  
  console.log('🔍 Notification Status:', status);
  return status;
};