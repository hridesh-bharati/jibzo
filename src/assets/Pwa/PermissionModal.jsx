import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Check current permissions
    const checkCurrentPermissions = async () => {
      const currentPermissions = {
        notifications: Notification.permission === 'granted',
        camera: await checkCameraPermission(),
        microphone: await checkMicrophonePermission(),
        location: await checkLocationPermission()
      };
      
      setPermissionsGranted(currentPermissions);
    };

    checkCurrentPermissions();
  }, []);

  const checkCameraPermission = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  };

  const checkMicrophonePermission = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  };

  const checkLocationPermission = async () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { timeout: 1000 }
      );
    });
  };

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
          if (navigator.mediaDevices?.getUserMedia) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              granted = true;
              stream.getTracks().forEach(track => track.stop());
              console.log('✅ Camera permission granted');
            } catch (error) {
              console.log('❌ Camera permission denied:', error);
              granted = false;
            }
          }
          break;

        case 'microphone':
          if (navigator.mediaDevices?.getUserMedia) {
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

      // Move to next step after delay
      if (currentStep < permissionSteps.length - 1) {
        setTimeout(() => {
          setCurrentStep(prev => prev + 1);
        }, 1000);
      } else {
        // Last step complete
        setTimeout(() => {
          onClose();
        }, 1500);
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
    localStorage.setItem('hasSeenPermissionModal', 'true');
    onClose();
  };

  const currentPermission = permissionSteps[currentStep];
  const progress = ((currentStep + 1) / permissionSteps.length) * 100;

  return (
    <div className="permission-overlay">
      <div className="permission-modal">
        {/* Progress Bar */}
        <div className="progress-container">
          <div 
            className="progress-bar"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Close Button */}
        <button className="close-btn" onClick={skipAll} aria-label="Close">
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
                <span className="benefit-text">{benefit}</span>
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
            className={`btn allow-btn ${permissionsGranted[currentPermission.type] ? 'btn-success' : 'btn-primary'}`}
            onClick={() => requestPermission(currentPermission.type)}
            disabled={permissionsGranted[currentPermission.type]}
          >
            {permissionsGranted[currentPermission.type] ? '✅ Permission Granted' : 'Allow Access'}
          </button>
          
          <button
            className="btn skip-btn"
            onClick={skipPermission}
          >
            {currentStep === permissionSteps.length - 1 ? 'Finish Setup' : 'Skip for now'}
          </button>

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