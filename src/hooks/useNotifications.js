import { useState, useEffect, useCallback } from 'react';
import { NotificationService } from '../assets/utils/notificationService';

export const useNotifications = (currentUser) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fcmInitialized, setFcmInitialized] = useState(false);

  // Initialize FCM
  useEffect(() => {
    if (currentUser?.uid && !fcmInitialized) {
      NotificationService.initializeFCM(currentUser.uid)
        .then(token => {
          if (token) {
            console.log('FCM initialized successfully');
            setFcmInitialized(true);
          }
        })
        .catch(error => {
          console.error('FCM initialization failed:', error);
        });
    }
  }, [currentUser, fcmInitialized]);

  // Listen to notifications
  useEffect(() => {
    if (!currentUser?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const unsubscribe = NotificationService.listenToNotifications(
      currentUser.uid,
      (notificationsList) => {
        setNotifications(notificationsList);
        const unread = notificationsList.filter(n => !n.read).length;
        setUnreadCount(unread);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!currentUser?.uid) return;
    
    try {
      await NotificationService.markAsRead(currentUser.uid, notificationId);
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }, [currentUser]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      await NotificationService.markAllAsRead(currentUser.uid);
    } catch (error) {
      console.error('Mark all as read error:', error);
      throw error;
    }
  }, [currentUser]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    if (!currentUser?.uid) return;
    
    try {
      await NotificationService.deleteNotification(currentUser.uid, notificationId);
    } catch (error) {
      console.error('Delete notification error:', error);
      throw error;
    }
  }, [currentUser]);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      await NotificationService.clearAllNotifications(currentUser.uid);
    } catch (error) {
      console.error('Clear all notifications error:', error);
      throw error;
    }
  }, [currentUser]);

  return {
    notifications,
    unreadCount,
    loading,
    fcmInitialized,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  };
};