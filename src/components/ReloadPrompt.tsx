import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const ReloadPrompt = () => {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      console.log("SW Registered:", r);
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      // Auto-reload when a new service worker is ready
      // This clears stale caches (e.g. old PWAInstallPrompt component)
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
};

export default ReloadPrompt;
