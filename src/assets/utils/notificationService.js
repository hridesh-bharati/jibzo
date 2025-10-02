import { ref, push, set, onValue, remove, get } from 'firebase/database';
import { db } from './firebaseConfig';
import { getFirebaseMessaging } from './firebaseConfig';
import { getToken, onMessage } from 'firebase/messaging';

export class NotificationService {
  // Send notification to database
  static async sendNotification(toUserId, fromUserId, type, data = {}) {
    try {
      const notificationRef = ref(db, `notifications/${toUserId}`);
      const newNotificationRef = push(notificationRef);
      
      const notificationData = {
        id: newNotificationRef.key,
        type, // 'follow_request', 'follow_accept', 'message', 'like'
        fromUserId,
        timestamp: Date.now(),
        read: false,
        data
      };

      await set(newNotificationRef, notificationData);
      
      return newNotificationRef.key;
    } catch (error) {
      console.error('Send notification error:', error);
      throw error;
    }
  }

  // Show browser/system notification
  static async showBrowserNotification(title, body, icon = '/icon.png') {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    // Check permission
    let permission = Notification.permission;
    
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      // Create and show notification
      const notification = new Notification(title, {
        body,
        icon: icon,
        badge: '/badge.png',
        image: icon,
        tag: 'social-app',
        requireInteraction: false,
        silent: false,
        actions: [
          {
            action: 'open',
            title: 'Open App'
          },
          {
            action: 'close', 
            title: 'Close'
          }
        ]
      });

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
        // You can navigate to specific page based on notification type
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    }
  }

  // Send follow request notification
  static async sendFollowRequestNotification(toUserId, fromUserId) {
    try {
      // Get user details
      const [fromUserSnap, toUserSnap] = await Promise.all([
        get(ref(db, `usersData/${fromUserId}`)),
        get(ref(db, `usersData/${toUserId}`))
      ]);

      const fromUserData = fromUserSnap.val() || {};
      const toUserData = toUserSnap.val() || {};

      const fromUserName = fromUserData.displayName || fromUserData.username || 'Someone';
      
      // Save to database
      await this.sendNotification(toUserId, fromUserId, 'follow_request');
      
      // Show browser notification
      await this.showBrowserNotification(
        'New Follow Request',
        `${fromUserName} wants to follow you`,
        fromUserData.photoURL || '/icon.png'
      );

    } catch (error) {
      console.error('Follow request notification error:', error);
    }
  }

  // Send follow accept notification
  static async sendFollowAcceptNotification(toUserId, fromUserId) {
    try {
      // Get user details
      const [fromUserSnap, toUserSnap] = await Promise.all([
        get(ref(db, `usersData/${fromUserId}`)),
        get(ref(db, `usersData/${toUserId}`))
      ]);

      const fromUserData = fromUserSnap.val() || {};
      const toUserData = toUserSnap.val() || {};

      const fromUserName = fromUserData.displayName || fromUserData.username || 'Someone';
      
      // Save to database
      await this.sendNotification(toUserId, fromUserId, 'follow_accept');
      
      // Show browser notification
      await this.showBrowserNotification(
        'Follow Request Accepted',
        `${fromUserName} accepted your follow request`,
        fromUserData.photoURL || '/icon.png'
      );

    } catch (error) {
      console.error('Follow accept notification error:', error);
    }
  }

  // Send message notification
  static async sendMessageNotification(toUserId, fromUserId, messageText) {
    try {
      const [fromUserSnap] = await Promise.all([
        get(ref(db, `usersData/${fromUserId}`))
      ]);

      const fromUserData = fromUserSnap.val() || {};
      const fromUserName = fromUserData.displayName || fromUserData.username || 'Someone';
      
      // Save to database
      await this.sendNotification(toUserId, fromUserId, 'message', {
        message: messageText
      });
      
      // Show browser notification
      await this.showBrowserNotification(
        `Message from ${fromUserName}`,
        messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText,
        fromUserData.photoURL || '/icon.png'
      );

    } catch (error) {
      console.error('Message notification error:', error);
    }
  }

  // Initialize FCM for push notifications
  static async initializeFCM(userId) {
    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.log('FCM not supported, using browser notifications');
        return null;
      }

      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });
        
        if (token) {
          console.log('FCM Token:', token);
          await set(ref(db, `fcmTokens/${userId}`), {
            token,
            createdAt: Date.now()
          });

          // Handle foreground messages
          onMessage(messaging, (payload) => {
            console.log('Foreground message:', payload);
            if (payload.notification) {
              this.showBrowserNotification(
                payload.notification.title,
                payload.notification.body,
                payload.notification.icon
              );
            }
          });

          return token;
        }
      }
      return null;
    } catch (error) {
      console.error('FCM initialization error:', error);
      return null;
    }
  }

  // Listen to notifications from database
  static listenToNotifications(userId, callback) {
    if (!userId) {
      console.log('No user ID provided for notifications');
      return () => {};
    }
    
    const notificationsRef = ref(db, `notifications/${userId}`);
    
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const notifications = Object.entries(data)
        .map(([id, notification]) => ({
          id,
          ...notification
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
      
      callback(notifications);
    }, (error) => {
      console.error('Notifications listener error:', error);
    });

    return unsubscribe;
  }

  // Mark as read
  static async markAsRead(userId, notificationId) {
    try {
      await set(ref(db, `notifications/${userId}/${notificationId}/read`), true);
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }

  // Mark all as read
  static async markAllAsRead(userId) {
    try {
      const notificationsRef = ref(db, `notifications/${userId}`);
      const snapshot = await get(notificationsRef);
      const data = snapshot.val() || {};
      
      const updates = {};
      Object.keys(data).forEach(id => {
        if (!data[id].read) {
          updates[`notifications/${userId}/${id}/read`] = true;
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await set(ref(db), updates);
      }
    } catch (error) {
      console.error('Mark all as read error:', error);
      throw error;
    }
  }

  // Delete notification
  static async deleteNotification(userId, notificationId) {
    try {
      await remove(ref(db, `notifications/${userId}/${notificationId}`));
    } catch (error) {
      console.error('Delete notification error:', error);
      throw error;
    }
  }

  // Clear all notifications
  static async clearAllNotifications(userId) {
    try {
      await remove(ref(db, `notifications/${userId}`));
    } catch (error) {
      console.error('Clear all notifications error:', error);
      throw error;
    }
  }
}