import React, { useEffect, useState } from "react";
import { FaDownload } from "react-icons/fa";

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIcon, setShowIcon] = useState(false);

  useEffect(() => {
    // Listen for beforeinstallprompt event
    const handler = (e) => {
      e.preventDefault(); // Prevent Chrome's mini prompt
      setDeferredPrompt(e);
      setShowIcon(true);
      localStorage.setItem("pwa-available", "true"); // mark PWA as installable
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setShowIcon(false);
      localStorage.removeItem("pwa-available");
      console.log("🎉 App installed!");
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    // Check localStorage on mount
    if (localStorage.getItem("pwa-available") === "true") {
      setShowIcon(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShowIcon(false);
      localStorage.removeItem("pwa-available");
    }
    setDeferredPrompt(null);
  };

  if (!showIcon) return null;

  return (
    <div
      onClick={handleInstall}
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px",
        borderRadius: "50%",
        backgroundColor: "#1976d2",
        color: "#fff",
        fontSize: "18px",
        marginLeft: "10px",
      }}
      title="Install App"
    >
      <FaDownload />
    </div>
  );
}
