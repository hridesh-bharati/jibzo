import React, { useEffect, useState } from "react";
import { FaDownload } from "react-icons/fa"; // Using react-icons for a simple icon

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIcon, setShowIcon] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowIcon(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Detect if app is already installed
    const handleAppInstalled = () => setShowIcon(false);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setShowIcon(false); // hide icon if installed
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
      }}
      title="Install App"
    >
      <FaDownload />
    </div>
  );
}
