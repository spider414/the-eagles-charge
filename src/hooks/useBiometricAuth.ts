import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

// Check if WebAuthn is supported
const isWebAuthnSupported = () => {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.create === "function" &&
    typeof navigator.credentials.get === "function"
  );
};

// Check if platform authenticator (biometric) is available
const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
  if (!isWebAuthnSupported()) return false;
  
  try {
    // First check if the API exists
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
      return false;
    }
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

// Generate a random challenge
const generateChallenge = (): Uint8Array => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return array;
};

// Convert ArrayBuffer to base64url (URL-safe base64)
const arrayBufferToBase64url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// Convert base64url to ArrayBuffer
const base64urlToArrayBuffer = (base64url: string): ArrayBuffer => {
  // Add padding if needed
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binaryString = atob(paddedBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Get stored credential ID
const getStoredCredentialId = (): string | null => {
  return localStorage.getItem("biometric_credential_id");
};

// Store credential ID
const storeCredentialId = (credentialId: string) => {
  localStorage.setItem("biometric_credential_id", credentialId);
};

// Remove stored credential
const removeStoredCredential = () => {
  localStorage.removeItem("biometric_credential_id");
};

// Get the correct RP ID for the current environment
const getRpId = (): string => {
  const hostname = window.location.hostname;
  // For localhost, don't set rpId (let browser handle it)
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return hostname;
  }
  // For production, use the hostname
  return hostname;
};

export const useBiometricAuth = () => {
  const { toast } = useToast();

  const checkBiometricSupport = useCallback(async (): Promise<boolean> => {
    try {
      const supported = await isPlatformAuthenticatorAvailable();
      return supported;
    } catch (error) {
      console.error("Error checking biometric support:", error);
      return false;
    }
  }, []);

  const registerBiometric = useCallback(async (userId: string): Promise<boolean> => {
    if (!isWebAuthnSupported()) {
      toast({
        title: "Not Supported",
        description: "Biometric authentication is not supported on this device or browser.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const challenge = generateChallenge();
      const userIdBuffer = new TextEncoder().encode(userId);
      const rpId = getRpId();
      
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: challenge.buffer as ArrayBuffer,
        rp: {
          name: "HARMIC RECHARGE",
          id: rpId,
        },
        user: {
          id: userIdBuffer.buffer as ArrayBuffer,
          name: userId,
          displayName: "HARMIC RECHARGE User",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256 (preferred for mobile)
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred", // Changed from "required" for better mobile compatibility
          residentKey: "discouraged", // Changed for better mobile support
          requireResidentKey: false,
        },
        timeout: 120000, // Increased timeout for mobile (2 minutes)
        attestation: "none",
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential | null;

      if (credential) {
        storeCredentialId(arrayBufferToBase64url(credential.rawId));
        toast({
          title: "Biometric Enabled",
          description: "You can now use fingerprint or face ID to unlock the app.",
        });
        return true;
      }
      
      return false;
    } catch (error: unknown) {
      console.error("Biometric registration error:", error);
      
      const errorName = error instanceof Error ? (error as { name?: string }).name : "";
      const errorMessage = error instanceof Error ? error.message : "";
      
      if (errorName === "NotAllowedError") {
        toast({
          title: "Cancelled",
          description: "Biometric setup was cancelled or denied.",
          variant: "destructive",
        });
      } else if (errorName === "NotSupportedError" || errorName === "SecurityError") {
        toast({
          title: "Not Supported",
          description: "Biometric authentication is not supported on this device.",
          variant: "destructive",
        });
      } else if (errorName === "InvalidStateError") {
        toast({
          title: "Already Registered",
          description: "Biometric is already set up. Try disabling and re-enabling.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Setup Failed",
          description: `Failed to set up biometric: ${errorMessage || "Unknown error"}`,
          variant: "destructive",
        });
      }
      
      return false;
    }
  }, [toast]);

  const authenticateWithBiometric = useCallback(async (): Promise<boolean> => {
    const storedCredentialId = getStoredCredentialId();
    
    if (!storedCredentialId) {
      toast({
        title: "Not Configured",
        description: "Please enable biometric login in Settings first.",
        variant: "destructive",
      });
      return false;
    }

    if (!isWebAuthnSupported()) {
      toast({
        title: "Not Supported",
        description: "Biometric authentication is not supported on this browser.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const challenge = generateChallenge();
      const credentialIdBuffer = base64urlToArrayBuffer(storedCredentialId);
      const rpId = getRpId();
      
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: challenge.buffer as ArrayBuffer,
        timeout: 120000, // Increased timeout for mobile (2 minutes)
        userVerification: "preferred", // Changed from "required" for better compatibility
        rpId: rpId,
        allowCredentials: [{
          id: credentialIdBuffer,
          type: "public-key",
          transports: ["internal", "hybrid"], // Added "hybrid" for better mobile support
        }],
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as PublicKeyCredential | null;

      if (assertion) {
        toast({
          title: "Authenticated",
          description: "Biometric verification successful!",
        });
        return true;
      }
      
      return false;
    } catch (error: unknown) {
      console.error("Biometric auth error:", error);
      
      const errorName = error instanceof Error ? (error as { name?: string }).name : "";
      
      if (errorName === "NotAllowedError") {
        toast({
          title: "Cancelled",
          description: "Biometric verification was cancelled or timed out.",
          variant: "destructive",
        });
      } else if (errorName === "InvalidStateError" || errorName === "NotFoundError") {
        // Credential may have been deleted or is invalid
        removeStoredCredential();
        toast({
          title: "Re-setup Required",
          description: "Please re-enable biometric login in Settings.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: "Biometric verification failed. Please try again.",
          variant: "destructive",
        });
      }
      
      return false;
    }
  }, [toast]);

  const disableBiometric = useCallback(() => {
    removeStoredCredential();
    toast({
      title: "Biometric Disabled",
      description: "Biometric login has been disabled.",
    });
  }, [toast]);

  const isBiometricEnabled = useCallback((): boolean => {
    return !!getStoredCredentialId();
  }, []);

  return {
    checkBiometricSupport,
    registerBiometric,
    authenticateWithBiometric,
    disableBiometric,
    isBiometricEnabled,
  };
};
