import { useState, useEffect } from "react";
import { X, Download, Smartphone, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if running as installed PWA - don't show if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Check if dismissed recently (only 1 day cooldown now)
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS prompt immediately
      setTimeout(() => setShowPrompt(true), 500);
      return;
    }

    // Handle Android/Desktop install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt immediately
      setTimeout(() => setShowPrompt(true), 500);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // For browsers that don't fire beforeinstallprompt, still show prompt after short delay
    const fallbackTimer = setTimeout(() => {
      if (!window.matchMedia("(display-mode: standalone)").matches) {
        setShowPrompt(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleDismiss}
      />
      
      {/* Centered modal prompt */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-gold">
              <Smartphone className="h-8 w-8 text-secondary-foreground" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-foreground mb-2">
              Install Eagles Charge
            </h3>
            <p className="text-muted-foreground mb-6">
              {isIOS 
                ? "Add this app to your home screen for quick access to airtime & data top-up anytime!"
                : "Install our app on your device for quick access to airtime & data top-up anytime!"
              }
            </p>

            {isIOS ? (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 text-left">
                  <p className="text-sm text-foreground font-medium mb-2">How to install:</p>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                      Tap the <Share className="h-4 w-4 inline mx-1" /> Share button below
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                      Scroll and tap "Add to Home Screen"
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                      Tap "Add" to confirm
                    </li>
                  </ol>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleDismiss}
                >
                  Got it!
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {deferredPrompt ? (
                  <Button 
                    onClick={handleInstall}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <Download className="h-5 w-5" />
                    Install App Now
                  </Button>
                ) : (
                  <div className="bg-muted/50 rounded-lg p-4 text-left">
                    <p className="text-sm text-foreground font-medium mb-2">How to install:</p>
                    <ol className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
                        Tap the menu icon (⋮) in your browser
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
                        Select "Add to Home Screen" or "Install App"
                      </li>
                    </ol>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  className="w-full text-muted-foreground"
                  onClick={handleDismiss}
                >
                  Maybe later
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PWAInstallPrompt;
