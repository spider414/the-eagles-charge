import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, Lock, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SessionLockContextType {
  isLocked: boolean;
  lockSession: () => void;
  unlockSession: () => void;
  resetInactivityTimer: () => void;
}

const SessionLockContext = createContext<SessionLockContextType | undefined>(undefined);

export const useSessionLock = () => {
  const context = useContext(SessionLockContext);
  if (!context) {
    throw new Error("useSessionLock must be used within a SessionLockProvider");
  }
  return context;
};

// Inactivity timeout in milliseconds (5 minutes)
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

export const SessionLockProvider = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const { authenticateWithBiometric, isBiometricEnabled } = useBiometricAuth();
  const navigate = useNavigate();
  
  const [isLocked, setIsLocked] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);

  const hasBiometric = isBiometricEnabled();

  const lockSession = useCallback(() => {
    if (user && hasBiometric) {
      setIsLocked(true);
      setShowLockDialog(true);
    }
  }, [user, hasBiometric]);

  const unlockSession = useCallback(() => {
    setIsLocked(false);
    setShowLockDialog(false);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }

    // Only set timer if user is logged in and biometric is enabled
    if (user && hasBiometric && !isLocked) {
      const timer = setTimeout(() => {
        lockSession();
      }, INACTIVITY_TIMEOUT);
      setInactivityTimer(timer);
    }
  }, [user, hasBiometric, isLocked, inactivityTimer, lockSession]);

  // Set up activity listeners
  useEffect(() => {
    if (!user || !hasBiometric) return;

    const handleActivity = () => {
      if (!isLocked) {
        resetInactivityTimer();
      }
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer
    resetInactivityTimer();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
    };
  }, [user, hasBiometric, isLocked, resetInactivityTimer]);

  // Handle visibility change (tab switch, app minimize)
  useEffect(() => {
    if (!user || !hasBiometric) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Lock when user leaves the app/tab
        if (inactivityTimer) {
          clearTimeout(inactivityTimer);
        }
        // Lock after 30 seconds of being hidden
        const hiddenTimer = setTimeout(() => {
          lockSession();
        }, 30000);
        setInactivityTimer(hiddenTimer);
      } else {
        // Reset timer when user returns
        if (!isLocked) {
          resetInactivityTimer();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, hasBiometric, isLocked, lockSession, resetInactivityTimer, inactivityTimer]);

  const handleBiometricUnlock = async () => {
    setIsAuthenticating(true);
    const success = await authenticateWithBiometric();
    setIsAuthenticating(false);

    if (success) {
      unlockSession();
      resetInactivityTimer();
    }
  };

  const handleLogout = async () => {
    await signOut();
    unlockSession();
    navigate("/");
  };

  return (
    <SessionLockContext.Provider
      value={{
        isLocked,
        lockSession,
        unlockSession,
        resetInactivityTimer,
      }}
    >
      {children}

      {/* Lock Screen Dialog */}
      <Dialog open={showLockDialog} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Session Locked
            </DialogTitle>
            <DialogDescription>
              Your session has been locked due to inactivity. Use biometrics to unlock.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-6">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Fingerprint className="h-12 w-12 text-primary" />
            </div>

            <p className="text-center text-muted-foreground">
              Tap below to unlock with fingerprint or face ID
            </p>

            <Button
              size="lg"
              className="w-full"
              onClick={handleBiometricUnlock}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                "Authenticating..."
              ) : (
                <>
                  <Fingerprint className="h-5 w-5 mr-2" />
                  Unlock with Biometrics
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
              disabled={isAuthenticating}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SessionLockContext.Provider>
  );
};
