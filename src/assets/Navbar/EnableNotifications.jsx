// src/components/EnableNotifications.jsx - IMPROVED VERSION
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { requestFcmToken } from '../utils/fcmClient';

// Temporary function - same as before
const saveFcmTokenToBackend = async (userId, token) => {
  try {
    console.log("💾 Saving FCM token to backend for user:", userId);
    
    const response = await fetch('/api/saveAndPush', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        token: token,
        title: 'Device Registered',
        body: 'Your device is ready to receive notifications'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Token saved to backend successfully:", result);
    return result;
  } catch (error) {
    console.error("❌ Failed to save token to backend:", error);
    throw new Error('Failed to save token: ' + error.message);
  }
};

const EnableNotifications = ({ userId, onEnabled }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  const enableNotifications = async () => {
    if (!userId) {
      toast.error("Please login first");
      return;
    }

    setIsLoading(true);
    
    try {
      console.log("🔔 Requesting notification permission...");
      
      // First check current permission
      if (Notification.permission === "granted") {
        toast.info("🔔 Notifications are already enabled!");
        setIsEnabled(true);
        if (onEnabled) onEnabled();
        return;
      }

      if (Notification.permission === "denied") {
        toast.info(
          "📵 Notifications blocked. Please enable them in your browser settings",
          { autoClose: 5000 }
        );
        return;
      }

      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission === "granted") {
        console.log("✅ Permission granted, getting FCM token...");
        const token = await requestFcmToken();
        
        if (token) {
          await saveFcmTokenToBackend(userId, token);
          toast.success("🎉 Notifications enabled successfully!");
          setIsEnabled(true);
          if (onEnabled) onEnabled();
        } else {
          toast.info("⚠️ Could not get device token. Please try again.");
        }
      } else if (permission === "denied") {
        toast.info(
          "🔕 Notifications blocked. You can enable them later in settings",
          { autoClose: 4000 }
        );
      } else {
        toast.info("💡 You can enable notifications anytime from settings");
      }
      
    } catch (error) {
      console.error("❌ Failed to enable notifications:", error);
      
      if (error.message.includes('permission') || error.message.includes('denied')) {
        toast.info("🔕 Please allow notifications in browser settings");
      } else {
        toast.error("❌ Failed to enable notifications. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Check current status on component mount
  React.useEffect(() => {
    if (Notification.permission === "granted") {
      setIsEnabled(true);
    }
  }, []);

  return (
    <button 
      onClick={enableNotifications}
      disabled={isLoading || isEnabled}
      className={`btn d-flex align-items-center gap-2 ${
        isEnabled ? "btn-success" : "btn-primary"
      }`}
      style={{minWidth: '200px'}}
      title={isEnabled ? "Notifications are enabled" : "Click to enable notifications"}
    >
      {isLoading ? (
        <>
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          Enabling...
        </>
      ) : isEnabled ? (
        <>
          <i className="bi bi-bell-fill"></i>
          Enabled ✅
        </>
      ) : (
        <>
          <i className="bi bi-bell"></i>
          Enable Notifications
        </>
      )}
    </button>
  );
};

export default EnableNotifications;