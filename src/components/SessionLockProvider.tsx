import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { usePinAuth } from "@/hooks/usePinAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Fingerprint, Lock, LogOut, KeyRound } from "lucide-react";
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
  const { verifyPin, isPinEnabled, isVerifying } = usePinAuth();
  const navigate = useNavigate();
  
  const [isLocked, setIsLocked] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);
  
  // PIN input state
  const [pinInput, setPinInput] = useState("");
  const [unlockMethod, setUnlockMethod] = useState<"biometric" | "pin">("biometric");

  const hasBiometric = isBiometricEnabled();
  const hasPin = isPinEnabled();
  const hasAnyLock = hasBiometric || hasPin;

  // Determine default unlock method
  useEffect(() => {
    if (hasBiometric) {
      setUnlockMethod("biometric");
    } else if (hasPin) {
      setUnlockMethod("pin");
    }
  }, [hasBiometric, hasPin]);

  const lockSession = useCallback(() => {
    if (user && hasAnyLock) {
      setIsLocked(true);
      setShowLockDialog(true);
      setPinInput("");
    }
  }, [user, hasAnyLock]);

  const unlockSession = useCallback(() => {
    setIsLocked(false);
    setShowLockDialog(false);
    setPinInput("");
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }

    // Only set timer if user is logged in and has lock enabled
    if (user && hasAnyLock && !isLocked) {
      const timer = setTimeout(() => {
        lockSession();
      }, INACTIVITY_TIMEOUT);
      setInactivityTimer(timer);
    }
  }, [user, hasAnyLock, isLocked, inactivityTimer, lockSession]);

  // Set up activity listeners
  useEffect(() => {
    if (!user || !hasAnyLock) return;

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
  }, [user, hasAnyLock, isLocked, resetInactivityTimer]);

  // Handle visibility change (tab switch, app minimize)
  useEffect(() => {
    if (!user || !hasAnyLock) return;

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
  }, [user, hasAnyLock, isLocked, lockSession, resetInactivityTimer, inactivityTimer]);

  const handleBiometricUnlock = async () => {
    setIsAuthenticating(true);
    const success = await authenticateWithBiometric();
    setIsAuthenticating(false);

    if (success) {
      unlockSession();
      resetInactivityTimer();
    }
  };

  const handlePinUnlock = async () => {
    if (!pinInput || pinInput.length < 4) return;
    
    const success = await verifyPin(pinInput);
    if (success) {
      unlockSession();
      resetInactivityTimer();
    } else {
      setPinInput("");
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
              Your session has been locked due to inactivity.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {/* Method selector (if both available) */}
            {hasBiometric && hasPin && (
              <div className="flex gap-2 w-full">
                <Button
                  variant={unlockMethod === "biometric" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setUnlockMethod("biometric")}
                >
                  <Fingerprint className="h-4 w-4 mr-2" />
                  Biometric
                </Button>
                <Button
                  variant={unlockMethod === "pin" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setUnlockMethod("pin")}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  PIN
                </Button>
              </div>
            )}

            {/* Biometric unlock */}
            {unlockMethod === "biometric" && hasBiometric && (
              <>
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Fingerprint className="h-10 w-10 text-primary" />
                </div>

                <p className="text-center text-sm text-muted-foreground">
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
              </>
            )}

            {/* PIN unlock */}
            {unlockMethod === "pin" && hasPin && (
              <>
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <KeyRound className="h-10 w-10 text-primary" />
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  Enter your PIN to unlock
                </p>

                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Enter PIN"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handlePinUnlock();
                    }
                  }}
                  className="text-center text-2xl tracking-widest h-14"
                  autoFocus
                />

                <Button
                  size="lg"
                  className="w-full"
                  onClick={handlePinUnlock}
                  disabled={isVerifying || pinInput.length < 4}
                >
                  {isVerifying ? (
                    "Verifying..."
                  ) : (
                    <>
                      <KeyRound className="h-5 w-5 mr-2" />
                      Unlock with PIN
                    </>
                  )}
                </Button>
              </>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
              disabled={isAuthenticating || isVerifying}
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
