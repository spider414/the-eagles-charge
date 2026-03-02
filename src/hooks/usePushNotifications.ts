import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await (reg as any).pushManager?.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      // Get VAPID public key from edge function
      const { data: vapidData } = await supabase.functions.invoke("send-notification", {
        body: { action: "vapid_public_key" },
      });

      if (!vapidData?.publicKey) {
        console.warn("VAPID keys not configured");
        return false;
      }

      const reg = await navigator.serviceWorker.ready as any;

      // Convert VAPID key
      const padding = "=".repeat((4 - (vapidData.publicKey.length % 4)) % 4);
      const base64 = (vapidData.publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = atob(base64);
      const applicationServerKey = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) {
        applicationServerKey[i] = rawData.charCodeAt(i);
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const json = subscription.toJSON();

      // Save to backend
      await supabase.functions.invoke("send-notification", {
        body: {
          action: "subscribe",
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        },
      });

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error("Push subscription error:", error);
      return false;
    }
  }, [isSupported, user]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready as any;
      const sub = await reg.pushManager?.getSubscription();
      if (sub) {
        const json = sub.toJSON();
        await sub.unsubscribe();

        await supabase.functions.invoke("send-notification", {
          body: { action: "unsubscribe", endpoint: json.endpoint },
        });
      }
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error("Push unsubscribe error:", error);
      return false;
    }
  }, []);

  return { isSupported, isSubscribed, permission, subscribe, unsubscribe };
};
