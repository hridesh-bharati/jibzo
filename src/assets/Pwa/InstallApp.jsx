// src/components/InstallButton.jsx
import { useEffect, useState } from "react";

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed via localStorage
    const installed = localStorage.getItem("jibzo_installed") === "true";
    setIsInstalled(installed);

    // Check if running in standalone mode (already installed)
    const isInStandaloneMode = () =>
      window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone ||
      document.referrer.includes('android-app://');

    setIsStandalone(isInStandaloneMode());

    // Check for iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      localStorage.setItem("jibzo_installed", "true");
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    // Check if PWA is already installed
    if (!installed && !isInStandaloneMode()) {
      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleAppInstalled);
    }

    // Show iOS install instructions
    if (isIOS && !isInStandaloneMode() && !installed) {
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        localStorage.setItem("jibzo_installed", "true");
        setIsInstalled(true);
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismissClick = () => {
    setIsVisible(false);
    // Store dismissal preference for 7 days
    const dismissalDate = new Date();
    dismissalDate.setDate(dismissalDate.getDate() + 7);
    localStorage.setItem("jibzo_install_dismissed", dismissalDate.toISOString());
  };

  const handleIOSInstructions = () => {
    alert(`To install Jibzo on your iOS device:
1. Tap the Share button (📤) at the bottom
2. Scroll down and tap "Add to Home Screen"
3. Tap "Add" in the top right
4. Enjoy Jibzo as an app!`);
  };

  // Check if dismissed recently
  useEffect(() => {
    const dismissedUntil = localStorage.getItem("jibzo_install_dismissed");
    if (dismissedUntil) {
      const dismissalDate = new Date(dismissedUntil);
      if (dismissalDate > new Date()) {
        setIsVisible(false);
      } else {
        localStorage.removeItem("jibzo_install_dismissed");
      }
    }
  }, []);

  if (!isVisible || isInstalled || isStandalone) return null;

  return (
    <div style={installContainerStyle}>
      <div style={installContentStyle}>
        <div style={installTextStyle}>
          <strong style={{ fontSize: "14px" }}>Install Jibzo App</strong>
          <small style={{ fontSize: "12px", opacity: 0.8 }}>
            {isIOS 
              ? "Add to home screen for better experience" 
              : "Install for faster access and offline support"
            }
          </small>
        </div>
        
        <div style={buttonGroupStyle}>
          {isIOS ? (
            <button
              onClick={handleIOSInstructions}
              style={iosButtonStyle}
            >
              📱 Install
            </button>
          ) : (
            <button
              onClick={handleInstallClick}
              style={installButtonStyle}
              disabled={!deferredPrompt}
            >
              ⬇️ Install
            </button>
          )}
          <button 
            onClick={handleDismissClick} 
            style={closeButtonStyle}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

const installContainerStyle = {
  position: "fixed",
  bottom: "20px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 10000,
  width: "90%",
  maxWidth: "400px",
  backgroundColor: "white",
  borderRadius: "12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  border: "1px solid #e0e0e0",
  animation: "slideUp 0.3s ease-out",
};

const installContentStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  gap: "12px",
};

const installTextStyle = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
};

const buttonGroupStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const installButtonStyle = {
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "8px 16px",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
};

const iosButtonStyle = {
  ...installButtonStyle,
  backgroundColor: "#28a745",
};

const closeButtonStyle = {
  backgroundColor: "transparent",
  color: "#666",
  border: "none",
  borderRadius: "50%",
  width: "32px",
  height: "32px",
  fontSize: "16px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
};

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
`;
document.head.appendChild(style);