// Complete Permissions Manager - Auto-request on app start
class PermissionsManager {
  constructor() {
    this.permissions = {
      camera: 'prompt',
      microphone: 'prompt', 
      notifications: 'prompt',
      location: 'prompt',
      storage: 'prompt'
    };
    this.listeners = new Map();
    this.isInitialized = false;
  }

  // Auto-initialize with gentle permission requests
  async init() {
    if (this.isInitialized) return;
    
    console.log('🔐 Initializing app permissions...');
    this.isInitialized = true;

    // Gentle permission checks (without immediate requests)
    await this.checkAllPermissions();
    
    // Auto-request only essential permissions
    await this.requestEssentialPermissions();
  }

  async checkAllPermissions() {
    await Promise.allSettled([
      this.checkCameraPermission(),
      this.checkMicrophonePermission(),
      this.checkNotificationPermission(),
      this.checkLocationPermission(),
      this.checkStoragePermission()
    ]);
    return this.permissions;
  }

  // Gentle permission checks (no popups)
  async checkCameraPermission() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return this.permissions.camera = 'unsupported';
      }
      // Just check without requesting
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      this.permissions.camera = hasCamera ? 'prompt' : 'unsupported';
      return this.permissions.camera;
    } catch (error) {
      return this.permissions.camera = 'error';
    }
  }

  async checkMicrophonePermission() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        return this.permissions.microphone = 'unsupported';
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(device => device.kind === 'audioinput');
      this.permissions.microphone = hasMic ? 'prompt' : 'unsupported';
      return this.permissions.microphone;
    } catch (error) {
      return this.permissions.microphone = 'error';
    }
  }

  async checkNotificationPermission() {
    if (!('Notification' in window)) {
      return this.permissions.notifications = 'unsupported';
    }
    this.permissions.notifications = Notification.permission;
    return this.permissions.notifications;
  }

  async checkLocationPermission() {
    if (!navigator.geolocation) {
      return this.permissions.location = 'unsupported';
    }
    return this.permissions.location = 'prompt';
  }

  async checkStoragePermission() {
    if (!navigator.storage?.estimate) {
      return this.permissions.storage = 'unsupported';
    }
    return this.permissions.storage = 'granted';
  }

  // Auto-request only essential permissions gently
  async requestEssentialPermissions() {
    try {
      // Only request notifications automatically (least intrusive)
      if (this.permissions.notifications === 'default') {
        setTimeout(async () => {
          try {
            await this.requestNotificationPermission();
          } catch (error) {
            console.log('User declined notifications');
          }
        }, 3000); // Wait 3 seconds after app load
      }

      // For other permissions, wait for user action
      console.log('✅ Essential permissions initialized');
    } catch (error) {
      console.warn('Permission initialization warning:', error);
    }
  }

  // Explicit permission requests (when user takes action)
  async requestCameraPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      this.permissions.camera = 'granted';
      this.notifyListeners('camera', 'granted');
      return 'granted';
    } catch (error) {
      const status = error.name === 'NotAllowedError' ? 'denied' : 'error';
      this.permissions.camera = status;
      this.notifyListeners('camera', status);
      throw error;
    }
  }

  async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      this.permissions.microphone = 'granted';
      this.notifyListeners('microphone', 'granted');
      return 'granted';
    } catch (error) {
      const status = error.name === 'NotAllowedError' ? 'denied' : 'error';
      this.permissions.microphone = status;
      this.notifyListeners('microphone', status);
      throw error;
    }
  }

  async requestCameraAndMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      this.currentStream = stream;
      this.permissions.camera = 'granted';
      this.permissions.microphone = 'granted';
      this.notifyListeners('camera', 'granted');
      this.notifyListeners('microphone', 'granted');
      return stream;
    } catch (error) {
      const status = error.name === 'NotAllowedError' ? 'denied' : 'error';
      this.permissions.camera = status;
      this.permissions.microphone = status;
      this.notifyListeners('camera', status);
      this.notifyListeners('microphone', status);
      throw error;
    }
  }

  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }
    const permission = await Notification.requestPermission();
    this.permissions.notifications = permission;
    this.notifyListeners('notifications', permission);
    return permission;
  }

  async requestLocationPermission() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation not supported'));
      }
      navigator.geolocation.getCurrentPosition(
        () => {
          this.permissions.location = 'granted';
          this.notifyListeners('location', 'granted');
          resolve('granted');
        },
        (error) => {
          const status = error.code === 1 ? 'denied' : 'error';
          this.permissions.location = status;
          this.notifyListeners('location', status);
          reject(error);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  }

  // Get permission status
  getPermission(permissionType) {
    return this.permissions[permissionType] || 'unknown';
  }

  getAllPermissions() {
    return { ...this.permissions };
  }

  isGranted(permissionType) {
    return this.permissions[permissionType] === 'granted';
  }

  // Request multiple permissions
  async requestMultiplePermissions(permissions) {
    const results = {};
    for (const permission of permissions) {
      try {
        switch (permission) {
          case 'camera':
            results.camera = await this.requestCameraPermission();
            break;
          case 'microphone':
            results.microphone = await this.requestMicrophonePermission();
            break;
          case 'camera+microphone':
            await this.requestCameraAndMicrophone();
            results.camera = 'granted';
            results.microphone = 'granted';
            break;
          case 'notifications':
            results.notifications = await this.requestNotificationPermission();
            break;
          case 'location':
            results.location = await this.requestLocationPermission();
            break;
        }
      } catch (error) {
        results[permission] = 'error';
      }
    }
    return results;
  }

  // Open browser settings
  openBrowserSettings() {
    if (navigator.userAgent.includes('Chrome')) {
      window.open('chrome://settings/content');
    } else if (navigator.userAgent.includes('Firefox')) {
      window.open('about:preferences#privacy');
    } else {
      alert('Please check your browser settings to manage permissions');
    }
  }

  // Show permission prompt UI
  showPermissionPrompt(permissionType, callback) {
    const descriptions = {
      camera: { title: 'Camera Access', description: 'Required for video calls and photos', icon: '📷' },
      microphone: { title: 'Microphone Access', description: 'Required for audio calls and voice messages', icon: '🎤' },
      notifications: { title: 'Notifications', description: 'Get notified about new messages and calls', icon: '🔔' },
      location: { title: 'Location Access', description: 'For location-based features', icon: '📍' }
    };

    const desc = descriptions[permissionType];
    if (!desc) return;

    const userChoice = confirm(
      `${desc.icon} ${desc.title}\n\n${desc.description}\n\nClick OK to allow, Cancel to skip.`
    );

    if (userChoice) {
      callback(true);
    } else {
      callback(false);
    }
  }

  // Event listeners
  addListener(permissionType, callback) {
    if (!this.listeners.has(permissionType)) {
      this.listeners.set(permissionType, new Set());
    }
    this.listeners.get(permissionType).add(callback);
  }

  removeListener(permissionType, callback) {
    const listeners = this.listeners.get(permissionType);
    if (listeners) listeners.delete(callback);
  }

  notifyListeners(permissionType, status) {
    const listeners = this.listeners.get(permissionType);
    if (listeners) {
      listeners.forEach(callback => callback(status, permissionType));
    }
  }

  // Cleanup
  cleanup() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
    this.listeners.clear();
  }
}

// Create single instance
const permissionsManager = new PermissionsManager();
export default permissionsManager;