/**
 * Android notification channel setup for the native (Capacitor) build.
 *
 * Android 8+ ignores per-notification sound/vibration/importance settings —
 * those are fixed by the CHANNEL the notification is posted to. This module
 * creates one high-importance channel so alerts pop up as heads-up banners at
 * the top of the screen with sound and vibration while the app is backgrounded.
 *
 * Web builds are unaffected: every export becomes a no-op off native.
 */

export const ALERT_CHANNEL_ID = "harmic_alerts";

export const isNativeApp = (): boolean =>
  typeof window !== "undefined" &&
  Boolean((window as any).Capacitor?.isNativePlatform?.());

const isAndroid = (): boolean =>
  isNativeApp() && (window as any).Capacitor?.getPlatform?.() === "android";

let channelReady: Promise<void> | null = null;

/** Creates the high-importance alert channel (idempotent, Android only). */
export const ensureAlertChannel = (): Promise<void> => {
  if (!isAndroid()) return Promise.resolve();
  if (channelReady) return channelReady;

  channelReady = (async () => {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.createChannel({
        id: ALERT_CHANNEL_ID,
        name: "Transaction & Account Alerts",
        description: "Wallet credits, transaction results and important account messages",
        importance: 5, // IMPORTANCE_HIGH -> heads-up banner at the top of the screen
        visibility: 1, // VISIBILITY_PUBLIC -> content shown on the lock screen
        sound: "default",
        vibration: true,
        lights: true,
        lightColor: "#1a6b47",
      });

      // Push (FCM) notifications must target the same channel to inherit it.
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        await (PushNotifications as any).createChannel?.({
          id: ALERT_CHANNEL_ID,
          name: "Transaction & Account Alerts",
          description: "Wallet credits, transaction results and important account messages",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true,
          lights: true,
          lightColor: "#1a6b47",
        });
      } catch {
        // push plugin not available in this build — local channel is enough
      }
    } catch (e) {
      console.warn("Notification channel setup skipped", e);
    }
  })();

  return channelReady;
};

/** Requests OS notification permission (Android 13+ / iOS). */
export type NativePermissionState = "granted" | "denied" | "prompt" | "unavailable";

/** Reads the current OS notification permission without prompting. */
export const getNativeNotificationPermission = async (): Promise<NativePermissionState> => {
  if (!isNativeApp()) return "unavailable";
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return "granted";
    if (current.display === "denied") return "denied";
    return "prompt";
  } catch {
    return "unavailable";
  }
};

export const requestNativeNotificationPermission = async (): Promise<boolean> => {
  if (!isNativeApp()) return false;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    const asked = await LocalNotifications.requestPermissions();
    return asked.display === "granted";
  } catch {
    return false;
  }
};

/** Posts a heads-up notification on the alert channel. */
export const showNativeAlert = async (
  title: string,
  body: string,
  extra?: Record<string, unknown>
): Promise<void> => {
  if (!isNativeApp()) return;
  try {
    await ensureAlertChannel();
    const granted = await requestNativeNotificationPermission();
    if (!granted) return;
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 2_000_000_000),
          title,
          body,
          channelId: ALERT_CHANNEL_ID,
          smallIcon: "ic_stat_icon_config_sample",
          extra: extra ?? {},
        },
      ],
    });
  } catch (e) {
    console.warn("Native alert failed", e);
  }
};
