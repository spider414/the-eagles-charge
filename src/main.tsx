import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Native Capacitor builds run inside a WebView with no browser install UI.
const isNative =
  typeof window !== "undefined" &&
  (!!(window as any).Capacitor?.isNativePlatform?.() ||
    /\bcapacitor:\/\//.test(window.location.protocol));

// Suppress any browser "Install app" prompt (web only — this app also ships
// as a native build for iOS/Android and never wants the install banner).
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
  });
}

// Evict legacy service workers + caches from prior PWA builds. Browser only:
// on native these APIs are unavailable/unnecessary, and the old forced
// window.location.reload() could loop and kill the app on startup.
if (typeof window !== "undefined" && !isNative) {
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
    } catch (e) {
      console.warn("Cache cleanup failed", e);
    }
  })();
}

// Surface (but never crash on) unexpected startup errors.
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    console.warn("Unhandled promise rejection:", e.reason);
  });
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}