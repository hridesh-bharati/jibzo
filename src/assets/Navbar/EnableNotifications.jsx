// src/components/EnableNotifications.jsx
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
      const token = await requestFcmToken();
      
      if (token) {
        await saveFcmTokenToBackend(userId, token);
        toast.success("🔔 Notifications enabled successfully!");
        if (onEnabled) onEnabled();
      } else {
        toast.info("Please allow notifications when prompted");
      }
    } catch (error) {
      console.error("Failed to enable notifications:", error);
      
      if (error.message.includes('permission')) {
        toast.info("Please enable notifications in your browser settings");
      } else {
        toast.error("Failed to enable notifications");
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