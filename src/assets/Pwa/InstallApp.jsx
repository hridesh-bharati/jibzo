import { useEffect, useState } from "react";

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (localStorage.getItem("appInstalled") === "true") {
      setIsInstalled(true);
      return;
    }

    // Save the deferred prompt when triggered
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Listen for beforeinstallprompt
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed event
    window.addEventListener("appinstalled", () => {
      localStorage.setItem("appInstalled", "true");
      setIsInstalled(true);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
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

  if (isInstalled) return null;

  return (
    <button
      onClick={handleInstallClick}
      style={installButtonStyle}
      disabled={!deferredPrompt}
    >
      Install App
    </button>
  );
}

const installButtonStyle = {
  zIndex: 1000,
  backgroundColor: "#28a745",
  color: "white",
  border: "none",
  borderRadius: "8px",
  fontSize: "10px",
  cursor: "pointer",
};
