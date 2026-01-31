import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePinAuth } from "@/hooks/usePinAuth";
import { KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";

interface PinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "setup" | "change" | "disable";
  onSuccess?: () => void;
}

export const PinSetupDialog = ({
  open,
  onOpenChange,
  mode,
  onSuccess,
}: PinSetupDialogProps) => {
  const { setupPin, changePin, disablePin, verifyPin, isSettingPin, isVerifying } = usePinAuth();
  
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPins, setShowPins] = useState(false);

  const resetForm = () => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setShowPins(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSetup = async () => {
    const success = await setupPin(newPin, confirmPin);
    if (success) {
      handleClose();
      onSuccess?.();
    }
  };

  const handleChange = async () => {
    const success = await changePin(currentPin, newPin, confirmPin);
    if (success) {
      handleClose();
      onSuccess?.();
    }
  };

  const handleDisable = async () => {
    const verified = await verifyPin(currentPin);
    if (verified) {
      disablePin();
      handleClose();
      onSuccess?.();
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "setup":
        return "Set Up PIN";
      case "change":
        return "Change PIN";
      case "disable":
        return "Disable PIN";
    }
  };

  const getDescription = () => {
    switch (mode) {
      case "setup":
        return "Create a 4-6 digit PIN to unlock your app.";
      case "change":
        return "Enter your current PIN and choose a new one.";
      case "disable":
        return "Enter your current PIN to disable PIN unlock.";
    }
  };

  const isLoading = isSettingPin || isVerifying;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current PIN (for change/disable) */}
          {(mode === "change" || mode === "disable") && (
            <div className="space-y-2">
              <Label htmlFor="currentPin">Current PIN</Label>
              <div className="relative">
                <Input
                  id="currentPin"
                  type={showPins ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Enter current PIN"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPins(!showPins)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPins ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* New PIN (for setup/change) */}
          {(mode === "setup" || mode === "change") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="newPin">
                  {mode === "setup" ? "PIN" : "New PIN"}
                </Label>
                <div className="relative">
                  <Input
                    id="newPin"
                    type={showPins ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Enter 4-6 digit PIN"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPins(!showPins)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPins ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose a PIN that's easy for you to remember but hard to guess.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPin">Confirm PIN</Label>
                <Input
                  id="confirmPin"
                  type={showPins ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Confirm your PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Cancel
          </Button>
          
          {mode === "setup" && (
            <Button
              className="flex-1"
              onClick={handleSetup}
              disabled={isLoading || newPin.length < 4 || confirmPin.length < 4}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                "Set PIN"
              )}
            </Button>
          )}

          {mode === "change" && (
            <Button
              className="flex-1"
              onClick={handleChange}
              disabled={isLoading || currentPin.length < 4 || newPin.length < 4 || confirmPin.length < 4}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change PIN"
              )}
            </Button>
          )}

          {mode === "disable" && (
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDisable}
              disabled={isLoading || currentPin.length < 4}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Disable PIN"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
