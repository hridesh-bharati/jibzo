// main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";

const root = createRoot(document.getElementById("root"));

// Service Worker register
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("✅ Service worker registered:", reg))
      .catch((err) => console.log("❌ Service worker failed:", err));
  });
}

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
