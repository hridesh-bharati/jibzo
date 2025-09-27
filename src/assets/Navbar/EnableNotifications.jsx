// src/components/EnableNotifications.jsx - TEMPORARY FIX
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { requestFcmToken } from '../utils/fcmClient';

// ✅ TEMPORARY: Add the missing function directly here
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

  const enableNotifications = async () => {
    if (!userId) {
      toast.error("User not logged in");
      return;
    }

    setIsLoading(true);
    
    try {
      console.log("🔄 Requesting FCM token...");
      const token = await requestFcmToken();
      
      if (token) {
        console.log("💾 Saving token to backend...");
        await saveFcmTokenToBackend(userId, token);
        toast.success("🔔 Notifications enabled successfully!");
        if (onEnabled) onEnabled();
      } else {
        toast.info("Please allow notifications when prompted");
      }
    } catch (error) {
      console.error("Failed to enable notifications:", error);
      
      if (error.message.includes('permission') || error.message.includes('denied')) {
        toast.info("🔕 Notifications blocked. Please enable them in browser settings");
      } else if (error.message.includes('Failed to save token')) {
        toast.error("⚠️ Failed to save device settings. Please try again.");
      } else {
        toast.error("❌ Failed to enable notifications");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={enableNotifications}
      disabled={isLoading}
      className="btn btn-primary d-flex align-items-center gap-2"
      style={{minWidth: '180px'}}
    >
      {isLoading ? (
        <>
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          Enabling...
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