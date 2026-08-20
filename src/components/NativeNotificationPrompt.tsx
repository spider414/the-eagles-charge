import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ensureAlertChannel,
  getNativeNotificationPermission,
  isNativeApp,
  requestNativeNotificationPermission,
} from "@/lib/nativeNotifications";

const DISMISS_KEY = "harmic:notif-prompt-dismissed";
const DELAY_MS = 4000;

/**
 * Friendly, well-timed notification permission request for the native build.
 *
 * It never fires on app launch or on the auth screen — it waits until the user
 * is signed in and has settled on a screen, explains the value first, and only
 * then triggers the Android/iOS system dialog. If permission is denied we show
 * a clear recovery message instead of silently failing.
 */
const NativeNotificationPrompt = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!isNativeApp() || !user) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      await ensureAlertChannel();
      const state = await getNativeNotificationPermission();
      if (cancelled) return;
      if (state === "prompt") setOpen(true);
      else if (state === "denied") {
        setDenied(true);
        setOpen(true);
      }
    }, DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user]);

  const dismiss = (remember: boolean) => {
    if (remember) localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  const handleEnable = async () => {
    setAsking(true);
    const granted = await requestNativeNotificationPermission();
    setAsking(false);
    if (granted) {
      localStorage.setItem(DISMISS_KEY, "1");
      window.dispatchEvent(new Event("native-notifications-granted"));
      setOpen(false);
    } else {
      setDenied(true);
    }
  };

  if (!isNativeApp()) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss(false)}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {denied ? (
              <BellOff className="h-6 w-6 text-muted-foreground" />
            ) : (
              <Bell className="h-6 w-6 text-primary" />
            )}
          </div>
          <DialogTitle className="text-center">
            {denied ? "Notifications are turned off" : "Stay on top of your wallet"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {denied ? (
              <>
                Android is blocking alerts from HARMIC RECHARGE, so you won't see wallet
                credits, transaction results or account messages on your phone.
                <br />
                <br />
                To turn them back on: open your phone <b>Settings → Apps → HARMIC
                RECHARGE → Notifications</b> and allow notifications.
              </>
            ) : (
              <>
                Get an instant alert when your wallet is funded, a purchase completes, or
                there's an important message about your account — even when the app is
                closed. No adverts, no spam.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {denied ? (
            <Button className="w-full" onClick={() => dismiss(true)}>
              Got it
            </Button>
          ) : (
            <>
              <Button className="w-full" onClick={handleEnable} disabled={asking}>
                {asking ? "Requesting…" : "Enable alerts"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => dismiss(true)}>
                Not now
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NativeNotificationPrompt;