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

// Always evict any legacy service worker + caches from prior PWA builds that
// showed the "Install Eagles Charge" prompt. Runs on every load so returning
// browsers can't resurrect the old install UI.
const CLEANUP_FLAG = "eagles-install-prompt-cleanup-v3";
if (typeof window !== "undefined") {
  (async () => {
    try {
      let didWork = false;
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length) {
          didWork = true;
          await Promise.all(regs.map((r) => r.unregister()));
        }
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        if (keys.length) {
          didWork = true;
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      }
      if (didWork && !localStorage.getItem(CLEANUP_FLAG)) {
        localStorage.setItem(CLEANUP_FLAG, "1");
        window.location.reload();
      }
    } catch (e) {
      console.warn("Cache cleanup failed", e);
    }
  })();
}

// Aggressively remove any legacy install-prompt DOM injected by an old cached
// bundle before React mounts and on every mutation until it's gone.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const killInstallPrompt = () => {
    const nodes = document.querySelectorAll("body *");
    nodes.forEach((n) => {
      const t = (n as HTMLElement).innerText || "";
      if (
        t.includes("Install Eagles Charge") ||
        t.includes("Add to Home Screen") ||
        (t.includes("Install our app") && t.includes("Maybe later"))
      ) {
        // Walk up to the prompt container (stop before #root)
        let el: HTMLElement | null = n as HTMLElement;
        while (el && el.parentElement && el.parentElement.id !== "root" && el.parentElement !== document.body) {
          el = el.parentElement;
        }
        if (el && el.id !== "root") el.remove();
      }
    });
  };
  killInstallPrompt();
  const mo = new MutationObserver(killInstallPrompt);
  document.addEventListener("DOMContentLoaded", () => {
    killInstallPrompt();
    mo.observe(document.body, { childList: true, subtree: true });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);