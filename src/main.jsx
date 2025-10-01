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

// ✅ FIXED SERVICE WORKER REGISTRATION
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      console.log('🔄 Registering service worker...');
      
      // Pehle existing registrations clear karo
      const existingRegistrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of existingRegistrations) {
        await registration.unregister();
        console.log('🗑️ Unregistered old SW:', registration.scope);
      }

      // Single service worker register karo
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      
      console.log("✅ Service Worker registered:", registration.scope);

      // Update tracking
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('🆕 New service worker found...');
        
        newWorker.addEventListener('statechange', () => {
          console.log('🔄 Service Worker state:', newWorker.state);
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🆕 New content available; please refresh.');
          }
        });
      });

      return registration;
    } catch (error) {
      console.error("❌ Service Worker registration failed:", error);
      return null;
    }
  } else {
    console.log("❌ Service Workers not supported in this browser");
    return null;
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

// ✅ ENHANCED INITIALIZATION
const initializeApp = async () => {
  console.log('🚀 Initializing Jibzo App...');
  
  // Service worker register karo
  await registerServiceWorker();
  
  // Additional initialization can go here
  console.log('✅ App initialization complete');
};

// DOM load hone ke baad initialize karo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}