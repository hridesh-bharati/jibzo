import { useEffect, useState } from "react";

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false); // temporary only

  useEffect(() => {
    // Check if already installed
    if (localStorage.getItem("appInstalled") === "true") {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      localStorage.setItem("appInstalled", "true");
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

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
        localStorage.setItem("appInstalled", "true");
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismissClick = () => {
    setIsDismissed(true); // temporary only (in memory)
  };

  if (isInstalled || isDismissed) return null;

  return (
    <div style={installContainerStyle}>
      <button
        onClick={handleInstallClick}
        style={installButtonStyle}
        disabled={!deferredPrompt}
      >
        Install App
      </button>
      <button onClick={handleDismissClick} style={closeButtonStyle}>
        ❌
      </button>
    </div>
  );
}

const installContainerStyle = {
  position: "fixed",
  bottom: "100px",
  right: "20px",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const installButtonStyle = {
  backgroundColor: "#28a745",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "12px 20px",
  fontSize: "16px",
  fontWeight: "600",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  transition: "background-color 0.3s ease",
};

const closeButtonStyle = {
  backgroundColor: "#ececec",
  color: "black",
  border: "none",
  borderRadius: "50%",
  width: "36px",
  height: "36px",
  fontSize: "16px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
};
