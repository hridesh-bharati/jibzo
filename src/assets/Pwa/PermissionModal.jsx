// src/assets/Pwa/PermissionModal.jsx
import React, { useState } from 'react';
import './PermissionModal.css';

const PermissionModal = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [permissionsGranted, setPermissionsGranted] = useState({
    notifications: false,
    camera: false,
    microphone: false,
    location: false
  });

  const permissionSteps = [
    {
      title: "🔔 Enable Notifications",
      description: "Get instant alerts for new messages, likes, and comments",
      icon: "🔔",
      type: "notifications",
      benefits: [
        "Real-time message alerts",
        "Post engagement notifications", 
        "Friend request updates"
      ]
    },
    {
      title: "📷 Camera Access", 
      description: "Take photos and videos to share with your friends",
      icon: "📷",
      type: "camera",
      benefits: [
        "Click and share photos instantly",
        "Video calling capability",
        "Story creation"
      ]
    },
    {
      title: "🎤 Microphone Access",
      description: "Send voice messages and make audio calls",
      icon: "🎤", 
      type: "microphone",
      benefits: [
        "Send voice messages",
        "Audio call friends",
        "Video call with audio"
      ]
    },
    {
      title: "📍 Location Access",
      description: "Share your location and discover nearby friends",
      icon: "📍",
      type: "location",
      benefits: [
        "Location-based posts",
        "Nearby friends discovery",
        "Location sharing in chats"
      ]
    }
  ];

  const requestPermission = async (type) => {
    try {
      let granted = false;

      switch (type) {
        case 'notifications':
          if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            granted = permission === 'granted';
            if (granted) {
              console.log('✅ Notifications permission granted');
            }
          }
          break;

        case 'camera':
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              granted = true;
              // Stream close karo - humko sirf permission chahiye
              stream.getTracks().forEach(track => track.stop());
              console.log('✅ Camera permission granted');
            } catch (error) {
              console.log('❌ Camera permission denied:', error);
              granted = false;
            }
          }
          break;

        case 'microphone':
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              granted = true;
              stream.getTracks().forEach(track => track.stop());
              console.log('✅ Microphone permission granted');
            } catch (error) {
              console.log('❌ Microphone permission denied:', error);
              granted = false;
            }
          }
          break;

        case 'location':
          if ('geolocation' in navigator) {
            try {
              await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  timeout: 5000,
                  maximumAge: 60000
                });
              });
              granted = true;
              console.log('✅ Location permission granted');
            } catch (error) {
              console.log('❌ Location permission denied:', error);
              granted = false;
            }
          }
          break;
      }

      setPermissionsGranted(prev => ({
        ...prev,
        [type]: granted
      }));

      // Update local storage
      const currentPermissions = JSON.parse(localStorage.getItem('appPermissions') || '{}');
      localStorage.setItem('appPermissions', JSON.stringify({
        ...currentPermissions,
        [type]: granted
      }));

      // Next step par jao
      if (currentStep < permissionSteps.length - 1) {
        setTimeout(() => {
          setCurrentStep(prev => prev + 1);
        }, 800);
      } else {
        // Last step complete - modal close karo
        setTimeout(() => {
          onClose();
        }, 1000);
      }

      return granted;
    } catch (error) {
      console.error(`Error requesting ${type} permission:`, error);
      return false;
    }
  };

  const skipPermission = () => {
    if (currentStep < permissionSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const skipAll = () => {
    onClose();
  };

  const currentPermission = permissionSteps[currentStep];

  return (
    <div className="permission-overlay">
      <div className="permission-modal">
        {/* Progress Bar */}
        <div className="progress-container">
          <div 
            className="progress-bar"
            style={{ width: `${((currentStep + 1) / permissionSteps.length) * 100}%` }}
          ></div>
        </div>

        {/* Close Button */}
        <button className="close-btn" onClick={skipAll}>
          ✕
        </button>

        {/* Content */}
        <div className="permission-content">
          <div className="permission-icon">
            {currentPermission.icon}
          </div>
          
          <h2 className="permission-title">
            {currentPermission.title}
          </h2>
          
          <p className="permission-description">
            {currentPermission.description}
          </p>

          {/* Benefits List */}
          <div className="benefits-list">
            {currentPermission.benefits.map((benefit, index) => (
              <div key={index} className="benefit-item">
                <span className="benefit-icon">✓</span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          {/* Permission Status */}
          <div className="permission-status">
            {permissionsGranted[currentPermission.type] ? (
              <div className="status granted">
                ✅ Permission Granted
              </div>
            ) : (
              <div className="status pending">
                Click "Allow" when prompted by your browser
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="permission-actions">
          <button
            className="btn btn-primary btn-lg allow-btn"
            onClick={() => requestPermission(currentPermission.type)}
            disabled={permissionsGranted[currentPermission.type]}
          >
            {permissionsGranted[currentPermission.type] ? '✅ Allowed' : 'Allow Access'}
          </button>
          
          <button
            className="btn btn-outline skip-btn"
            onClick={skipPermission}
          >
            {currentStep === permissionSteps.length - 1 ? 'Finish Setup' : 'Skip for now'}
          </button>

          {/* Small text for skip */}
          <p className="skip-note">
            You can always enable these in settings later
          </p>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator">
          {currentStep + 1} of {permissionSteps.length}
        </div>
      </div>
    </div>
  );
};

export default PermissionModal;