import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ensureAlertChannel,
  isNativeApp,
  getNativeNotificationPermission,
  showNativeAlert,
  ALERT_CHANNEL_ID,
} from "@/lib/nativeNotifications";

/**
 * Native (Android/iOS) notification wiring:
 *  - creates the high-importance alert channel on startup
 *  - registers push only once permission is already granted (the friendly
 *    in-app prompt in `NativeNotificationPrompt` owns asking for it)
 *  - registers the FCM token so the backend can push to the device
 *  - mirrors new `notifications` rows as heads-up alerts on that channel
 *    whenever the app is not in the foreground
 */
export const useNativeNotificationChannel = () => {
  const { user } = useAuth();

  // Channel + permission + FCM token registration
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;

    (async () => {
      await ensureAlertChannel();
      const state = await getNativeNotificationPermission();
      if (state !== "granted" || cancelled || !user) return;

      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive !== "granted") {
          const asked = await PushNotifications.requestPermissions();
          if (asked.receive !== "granted") return;
        }

        await PushNotifications.addListener("registration", async (token) => {
          try {
            await supabase.from("push_subscriptions").upsert(
              {
                user_id: user.id,
                endpoint: `fcm:${token.value}`,
                p256dh: "native",
                auth: ALERT_CHANNEL_ID,
              },
              { onConflict: "user_id,endpoint" }
            );
          } catch {
            // token storage is best-effort
          }
        });

        await PushNotifications.addListener("registrationError", (err) =>
          console.warn("Push registration error", err)
        );

        await PushNotifications.register();
      } catch {
        // push plugin unavailable (e.g. no google-services.json yet)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Mirror realtime notifications to the OS while the app is backgrounded
  useEffect(() => {
    if (!isNativeApp() || !user) return;

    const channel = supabase
      .channel(`native-alerts-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as { title?: string; body?: string; type?: string };
          if ((n.type ?? "").startsWith("admin_")) return;
          if (document.visibilityState === "visible") return; // in-app toast already shows
          void showNativeAlert(n.title || "HARMIC RECHARGE", n.body || "", { type: n.type });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
};
