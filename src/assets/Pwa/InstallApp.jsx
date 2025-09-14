// src/assets/Pwa/InstallApp.jsx
import React, { useEffect, useState } from "react";
import { FaDownload } from "react-icons/fa";

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (localStorage flag)
    if (localStorage.getItem("pwa-installed") === "true") {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      console.log("🎉 App installed!");
      setIsInstalled(true);
      localStorage.setItem("pwa-installed", "true");
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("✅ User accepted install");
    } else {
      console.log("❌ User dismissed install");
    }
    setDeferredPrompt(null);
  };

  // ❌ Agar installed hai to button hi mat dikhao
  if (isInstalled) return null;

  return (
    <button
      onClick={handleInstall}
      className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
      style={{ fontSize: "0.7rem" }}
    >
      <FaDownload />
      <span>Install App</span>
    </button>
  );
}
