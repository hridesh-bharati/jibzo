import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { toast } from 'react-toastify';

const NotificationBell = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  } = useNotifications(currentUser);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Handle notification action
    switch (notification.type) {
      case 'follow_request':
        toast.info('You have a new follow request');
        // You can navigate to follow requests page here
        break;
      case 'follow_accept':
        toast.success('Your follow request was accepted!');
        break;
      case 'message':
        toast.info('You have a new message');
        // You can navigate to messages page here
        break;
      default:
        toast.info('New notification');
    }
    
    setIsOpen(false);
  };

  const formatTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'follow_request': return 'bi bi-person-plus text-primary';
      case 'follow_accept': return 'bi bi-person-check text-success';
      case 'message': return 'bi bi-chat-text text-info';
      case 'like': return 'bi bi-heart text-danger';
      default: return 'bi bi-bell text-warning';
    }
  };

  const getNotificationMessage = (type) => {
    switch (type) {
      case 'follow_request': return 'sent you a follow request';
      case 'follow_accept': return 'accepted your follow request';
      case 'message': return 'sent you a message';
      case 'like': return 'liked your post';
      default: return 'sent you a notification';
    }
  };

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // You can ask for permission when user interacts with bell
      console.log('Notification permission can be requested');
    }
  }, []);

  if (loading) {
    return (
      <button className="btn btn-outline-secondary position-relative" disabled>
        <i className="bi bi-bell fs-5"></i>
        <div className="spinner-border spinner-border-sm position-absolute top-0 start-100 translate-middle"></div>
      </button>
    );
  }

  return (
    <div className="position-relative" ref={dropdownRef}>
      {/* Notification Bell */}
      <button
        className="btn btn-outline-secondary position-relative"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        <i className="bi bi-bell fs-5"></i>
        {unreadCount > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="position-absolute top-100 end-0 mt-2 bg-white rounded shadow-lg border"
             style={{ width: '400px', maxHeight: '500px', zIndex: 1050 }}>
          
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
            <h6 className="mb-0 fw-bold">Notifications</h6>
            <div className="d-flex gap-2">
              {unreadCount > 0 && (
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={markAllAsRead}
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={clearAllNotifications}
                  title="Clear all"
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-auto" style={{ maxHeight: '400px' }}>
            {notifications.length === 0 ? (
              <div className="text-center text-muted py-4">
                <i className="bi bi-bell-slash display-6 mb-2"></i>
                <p className="mb-0">No notifications yet</p>
                <small>When you get notifications, they'll appear here</small>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 border-bottom notification-item ${!notification.read ? 'bg-light' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="d-flex align-items-start">
                    <div className="flex-shrink-0">
                      <i className={`${getNotificationIcon(notification.type)} fs-5 me-2`}></i>
                    </div>
                    <div className="flex-grow-1">
                      <p className="mb-1 small">
                        <strong>User</strong> {getNotificationMessage(notification.type)}
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted">
                          {formatTime(notification.timestamp)}
                        </small>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          title="Delete notification"
                        >
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="flex-shrink-0">
                        <span className="badge bg-primary">New</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-top text-center">
              <small className="text-muted">
                {notifications.length} notification{notifications.length > 1 ? 's' : ''}
                {unreadCount > 0 && ` • ${unreadCount} unread`}
              </small>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .notification-item:hover {
          background-color: #f8f9fa !important;
        }
      `}</style>
    </div>
  );
};

export default NotificationBell;