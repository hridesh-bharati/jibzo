// src\assets\messages\FloatingNotifications.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import './FloatingNotifications.css';

const FloatingNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Global event listener for push notifications
    const handlePushNotification = (event) => {
      const { title, body, image, url } = event.detail;
      
      addFloatingNotification({
        id: Date.now(),
        title,
        body,
        image,
        timestamp: new Date(),
        url
      });
    };

    // Listen for custom push events
    window.addEventListener('showFloatingNotification', handlePushNotification);
    
    return () => {
      window.removeEventListener('showFloatingNotification', handlePushNotification);
    };
  }, []);

  const addFloatingNotification = (notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Max 5 notifications
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeNotification(notification.id);
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const handleNotificationClick = (notification) => {
    if (notification.url) {
      window.location.href = notification.url;
    }
    removeNotification(notification.id);
  };

  return (
    <div className="floating-notifications-container">
      {notifications.map(notification => (
        <div 
          key={notification.id}
          className="floating-notification"
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="notification-image">
            <img 
              src={notification.image || '/logo.png'} 
              alt={notification.title}
            />
          </div>
          <div className="notification-content">
            <div className="notification-title">{notification.title}</div>
            <div className="notification-body">{notification.body}</div>
            <div className="notification-time">
              {formatTimeAgo(notification.timestamp)}
            </div>
          </div>
          <button 
            className="notification-close"
            onClick={(e) => {
              e.stopPropagation();
              removeNotification(notification.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const diff = now - new Date(timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default FloatingNotifications;