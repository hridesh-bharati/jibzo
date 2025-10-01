import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h2>Something went wrong</h2>
          <p>We're working on fixing this issue.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Reload App
          </button>
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
      console.log('🔄 Registering Service Worker...');
      
      // Clear existing registrations
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
        console.log('🗑️ Unregistered old SW:', registration.scope);
      }

      // Register main service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });

      console.log("✅ Service Worker registered:", registration.scope);

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('🆕 New Service Worker installing...');

        newWorker.addEventListener('statechange', () => {
          console.log('🔄 Service Worker state:', newWorker.state);
          
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🆕 New content available! Please refresh.');
            
            // Show update notification to user
            if (window.confirm('New version available! Reload to update?')) {
              window.location.reload();
            }
          }
        });
      });

      // Check for updates
      await registration.update();

      return registration;
    } catch (error) {
      console.error("❌ Service Worker registration failed:", error);
      return null;
    }
  } else {
    console.log("❌ Service Workers not supported");
    return null;
  }
};

// Initialize App
const initializeApp = async () => {
  try {
    // Register service worker
    await registerServiceWorker();
    
    // Render app
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
    
    console.log("✅ App initialized successfully");
  } catch (error) {
    console.error("❌ App initialization failed:", error);
  }
};

// Start the app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}