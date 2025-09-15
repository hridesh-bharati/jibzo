// src/assets/Pwa/InstallApp.jsx
import React, { useEffect, useState } from "react";
import { FaDownload } from "react-icons/fa";

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (localStorage.getItem("pwa-installed") === "true") {
      setIsInstalled(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    // Detect standalone mode
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      localStorage.setItem("pwa-installed", "true");
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (isStandalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      alert(
        "To install this app:\n1. Tap the Share button\n2. Select 'Add to Home Screen'\n3. Tap 'Add'"
      );
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      localStorage.setItem("pwa-installed", "true");
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) return null; // Hide button if installed

  return (
    <button
      onClick={handleInstall}
      className="btn btn-primary d-flex align-items-center btn-sm"
    >
      <FaDownload /> 
      {isIOS ? " Install App " : " Install "}
    </button>
  );
}
