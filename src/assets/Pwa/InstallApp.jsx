import React, { useEffect, useState } from "react";

const InstallApp = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
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

  return (
    <button
      className={`btn fw-bold small ${deferredPrompt ? "btn-success" : "btn-secondary"}`}
      onClick={handleInstall}
      disabled={!deferredPrompt} // disabled if not available
    >
      <div className="small"> Install App</div>
    </button>
  );
};

export default InstallApp;
