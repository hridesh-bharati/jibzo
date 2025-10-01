// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <button onClick={() => window.location.reload()}>
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced Service Worker registration
const registerServiceWorkers = async () => {
  if ('serviceWorker' in navigator) {
    try {
      console.log('🔄 Registering service workers...');
      
      // Pehle existing registrations clear karo
      const existingRegistrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of existingRegistrations) {
        await registration.unregister();
        console.log('🗑️ Unregistered old SW:', registration.scope);
      }

      // Main service worker register karo
      try {
        const mainSW = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none'
        });
        console.log("✅ Main Service Worker registered:", mainSW.scope);
        
        mainSW.addEventListener('updatefound', () => {
          const newWorker = mainSW.installing;
          console.log('🆕 New service worker found...');
          
          newWorker.addEventListener('statechange', () => {
            console.log('🔄 Service Worker state:', newWorker.state);
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🆕 New content available; please refresh.');
            }
          });
        });
      } catch (mainError) {
        console.error("❌ Main Service Worker registration failed:", mainError);
      }

      // Firebase messaging service worker register karo
      try {
        const messagingSW = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/firebase-cloud-messaging-push-scope'
        });
        console.log("✅ Firebase Messaging Service Worker registered:", messagingSW.scope);
      } catch (messagingError) {
        console.error("❌ Firebase Messaging SW registration failed:", messagingError);
      }

    } catch (error) {
      console.error("❌ Service Worker registration failed:", error);
    }
  } else {
    console.log("❌ Service Workers not supported in this browser");
  }
};

const root = createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// DOM load hone ke baad service workers register karo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', registerServiceWorkers);
} else {
  registerServiceWorkers();
}