import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress any browser "Install app" prompt. This app ships as a native
// Capacitor build for iOS/Android — we never want the PWA install banner.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
  });
  window.addEventListener("appinstalled", (e) => {
    e.preventDefault?.();
  });
}

// One-time cleanup: remove stale service worker caches from a previous build
// that shipped an old "Install Eagles Charge" PWA prompt. Runs once per browser.
const CLEANUP_FLAG = "eagles-install-prompt-cleanup-v2";
if (typeof window !== "undefined" && !localStorage.getItem(CLEANUP_FLAG)) {
  localStorage.setItem(CLEANUP_FLAG, "1");
  (async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      window.location.reload();
    } catch (e) {
      console.warn("Cache cleanup failed", e);
    }
  })();
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);