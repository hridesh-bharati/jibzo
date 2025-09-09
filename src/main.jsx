// src\main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { requestForToken, onMessageListener } from "./assets/utils/PushNotification";

// Register SW
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("✅ Service worker registered:", reg))
      .catch((err) => console.log("❌ Service worker failed:", err));
    
    const token = await requestForToken();
    console.log("FCM Token:", token);

    onMessageListener().then((payload) => {
      console.log("Foreground notification:", payload);
      alert(`${payload.notification.title}: ${payload.notification.body}`);
    });
  });
}

const root = createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
