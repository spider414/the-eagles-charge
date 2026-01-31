import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const PIN_STORAGE_KEY = "app_pin_hash";
const PIN_SALT_KEY = "app_pin_salt";

// Generate a random salt
const generateSalt = (): string => {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
};

// Hash the PIN using Web Crypto API (PBKDF2)
const hashPin = async (pin: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  const saltData = encoder.encode(salt);

  // Import PIN as key material
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    pinData,
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  // Derive bits using PBKDF2
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltData,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(derivedBits));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

// Get stored PIN hash and salt
const getStoredPinData = (): { hash: string; salt: string } | null => {
  const hash = localStorage.getItem(PIN_STORAGE_KEY);
  const salt = localStorage.getItem(PIN_SALT_KEY);
  if (hash && salt) {
    return { hash, salt };
  }
  return null;
};

// Store PIN hash and salt
const storePinData = (hash: string, salt: string): void => {
  localStorage.setItem(PIN_STORAGE_KEY, hash);
  localStorage.setItem(PIN_SALT_KEY, salt);
};

// Remove stored PIN
const removeStoredPin = (): void => {
  localStorage.removeItem(PIN_STORAGE_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
};

// Validate PIN format (4-6 digits)
const isValidPinFormat = (pin: string): boolean => {
  return /^\d{4,6}$/.test(pin);
};

export const usePinAuth = () => {
  const { toast } = useToast();
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const isPinEnabled = useCallback((): boolean => {
    return getStoredPinData() !== null;
  }, []);

  const setupPin = useCallback(
    async (pin: string, confirmPin: string): Promise<boolean> => {
      // Validate PIN format
      if (!isValidPinFormat(pin)) {
        toast({
          title: "Invalid PIN",
          description: "PIN must be 4-6 digits.",
          variant: "destructive",
        });
        return false;
      }

      // Check PINs match
      if (pin !== confirmPin) {
        toast({
          title: "PINs Don't Match",
          description: "Please make sure both PINs are the same.",
          variant: "destructive",
        });
        return false;
      }

      // Check for weak PINs
      const weakPins = ["0000", "1111", "1234", "4321", "0123", "9999", "123456"];
      if (weakPins.includes(pin)) {
        toast({
          title: "Weak PIN",
          description: "Please choose a stronger PIN.",
          variant: "destructive",
        });
        return false;
      }

      setIsSettingPin(true);

      try {
        const salt = generateSalt();
        const hash = await hashPin(pin, salt);
        storePinData(hash, salt);

        toast({
          title: "PIN Set Successfully",
          description: "You can now use your PIN to unlock the app.",
        });

        return true;
      } catch (error) {
        console.error("Error setting PIN:", error);
        toast({
          title: "Error",
          description: "Failed to set PIN. Please try again.",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsSettingPin(false);
      }
    },
    [toast]
  );

  const verifyPin = useCallback(
    async (pin: string): Promise<boolean> => {
      const storedData = getStoredPinData();

      if (!storedData) {
        toast({
          title: "PIN Not Set",
          description: "Please set up a PIN in Settings first.",
          variant: "destructive",
        });
        return false;
      }

      if (!isValidPinFormat(pin)) {
        toast({
          title: "Invalid PIN",
          description: "Please enter your 4-6 digit PIN.",
          variant: "destructive",
        });
        return false;
      }

      setIsVerifying(true);

      try {
        const hash = await hashPin(pin, storedData.salt);

        if (hash === storedData.hash) {
          toast({
            title: "Unlocked",
            description: "PIN verified successfully!",
          });
          return true;
        } else {
          toast({
            title: "Incorrect PIN",
            description: "Please try again.",
            variant: "destructive",
          });
          return false;
        }
      } catch (error) {
        console.error("Error verifying PIN:", error);
        toast({
          title: "Error",
          description: "Failed to verify PIN. Please try again.",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsVerifying(false);
      }
    },
    [toast]
  );

  const changePin = useCallback(
    async (currentPin: string, newPin: string, confirmNewPin: string): Promise<boolean> => {
      // First verify current PIN
      const storedData = getStoredPinData();
      if (!storedData) {
        toast({
          title: "No PIN Set",
          description: "You don't have a PIN set up.",
          variant: "destructive",
        });
        return false;
      }

      const currentHash = await hashPin(currentPin, storedData.salt);
      if (currentHash !== storedData.hash) {
        toast({
          title: "Incorrect Current PIN",
          description: "Please enter your current PIN correctly.",
          variant: "destructive",
        });
        return false;
      }

      // Set new PIN
      return setupPin(newPin, confirmNewPin);
    },
    [toast, setupPin]
  );

  const disablePin = useCallback(() => {
    removeStoredPin();
    toast({
      title: "PIN Disabled",
      description: "PIN unlock has been disabled.",
    });
  }, [toast]);

  return {
    isPinEnabled,
    setupPin,
    verifyPin,
    changePin,
    disablePin,
    isSettingPin,
    isVerifying,
  };
};
