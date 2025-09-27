// src/components/EnableNotifications.jsx - UPDATED
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { requestFcmToken, saveFcmTokenToBackend } from '../utils/fcmClient';

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