// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import App from "./App.jsx";
import "./index.css";
import "react-toastify/dist/ReactToastify.css";

// Utils
import permissionsManager from "./assets/utils/PermissionsManager.js";
import { initializeNotifications } from "./assets/utils/firebaseConfig";

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error to analytics service (if available)
    console.error("Application Error:", error, errorInfo);
    
    // You can also send errors to your error reporting service here
    // logErrorToService(error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h1>Something went wrong</h1>
            <p>We're sorry for the inconvenience. Please try reloading the page.</p>
            
            <div className="error-actions">
              <button 
                className="btn btn-primary" 
                onClick={this.handleReload}
              >
                Reload App
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={this.handleGoHome}
              >
                Go Home
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Error Details (Development)</summary>
                <pre>{this.state.error && this.state.error.toString()}</pre>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Service Worker Registration
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // Register both service workers
      const [swRegistration, messagingSwRegistration] = await Promise.all([
        navigator.serviceWorker.register('/sw.js'),
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
      ]);

      console.log("✅ App Service Worker registered:", swRegistration);
      console.log("✅ Firebase Messaging Service Worker registered:", messagingSwRegistration);

      // Handle updates
      swRegistration.addEventListener('updatefound', () => {
        const newWorker = swRegistration.installing;
        console.log('🔄 New service worker version found...');
        
        newWorker.addEventListener('statechange', () => {
          console.log(`🔄 Service Worker state: ${newWorker.state}`);
          
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🎯 New content available; please refresh.');
            
            // You can show an update notification here
            if (window.showUpdateNotification) {
              window.showUpdateNotification();
            }
          }
        });
      });

      return swRegistration;
    } catch (error) {
      console.error("❌ Service Worker registration failed:", error);
      return null;
    }
  } else {
    console.log("ℹ️ Service Workers are not supported in this browser");
    return null;
  }
};

// Application Initialization
const initializeApp = async () => {
  console.log("🚀 Starting Jibzo App...");
  
  try {
    // Initialize permissions
    await permissionsManager.init();
    console.log("✅ App permissions initialized successfully");

    // Initialize notifications
    const fcmToken = await initializeNotifications();
    if (fcmToken) {
      console.log("✅ Notifications initialized with token");
      // Here you can send the token to your backend
      // await saveFCMTokenToBackend(fcmToken);
    }

    // Register service workers
    await registerServiceWorker();
    
    console.log("🎉 App initialization completed successfully");
  } catch (error) {
    console.warn("⚠️ App initialization warning:", error);
    // Non-critical errors shouldn't block app startup
  }
};

// Get root element and render app
const container = document.getElementById("root");
const root = createRoot(container);

// Render the app
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// Initialize app after render
initializeApp().catch(console.error);

// Add global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Global Error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
});

// PWA: Track app installation
window.addEventListener('appinstalled', () => {
  console.log('🎉 PWA installed successfully');
});

// Export for potential use in other files
export { initializeApp };