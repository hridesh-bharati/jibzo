import React, { useEffect, useState } from "react";

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Save install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      console.log("✅ App installed successfully");
      setIsInstalled(true);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert("❌ Install prompt is not available right now.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("✅ User accepted PWA install");
    } else {
      console.log("❌ User dismissed PWA install");
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) return null; // hide button if already installed

  return (
    <button
      className={`btn fw-bold small ${deferredPrompt ? "btn-success" : "btn-primary"}`}
      onClick={handleInstall}
    >
      <div className="small">Install App</div>
    </button>
  );
};

export default InstallApp;
