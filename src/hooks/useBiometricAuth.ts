import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

// Check if WebAuthn is supported
const isWebAuthnSupported = () => {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials
  );
};

// Check if platform authenticator (biometric) is available
const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
  if (!isWebAuthnSupported()) return false;
  
  try {
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

// Convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

export const useBiometricAuth = () => {
  const { toast } = useToast();

  const checkBiometricSupport = useCallback(async (): Promise<boolean> => {
    const supported = await isPlatformAuthenticatorAvailable();
    return supported;
  }, []);

  const registerBiometric = useCallback(async (userId: string): Promise<boolean> => {
    if (!isWebAuthnSupported()) {
      toast({
        title: "Not Supported",
        description: "Biometric authentication is not supported on this device.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const challenge = generateChallenge();
      const userIdBuffer = new TextEncoder().encode(userId);
      
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: challenge.buffer as ArrayBuffer,
        rp: {
          name: "THE EAGLES VTU",
          id: window.location.hostname,
        },
        user: {
          id: userIdBuffer.buffer as ArrayBuffer,
          name: userId,
          displayName: "Eagles User",
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential | null;

      if (credential) {
        storeCredentialId(arrayBufferToBase64(credential.rawId));
        toast({
          title: "Biometric Enabled",
          description: "You can now use fingerprint or face ID to login.",
        });
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error("Biometric registration error:", error);
      
      if (error.name === "NotAllowedError") {
        toast({
          title: "Cancelled",
          description: "Biometric setup was cancelled.",
          variant: "destructive",
        });
      } else if (error.name === "NotSupportedError") {
        toast({
          title: "Not Supported",
          description: "Your device doesn't support biometric authentication.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to set up biometric authentication.",
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

    try {
      const challenge = generateChallenge();
      
      // Convert base64 back to ArrayBuffer
      const binaryString = atob(storedCredentialId);
      const credentialIdBuffer = new ArrayBuffer(binaryString.length);
      const credentialIdView = new Uint8Array(credentialIdBuffer);
      for (let i = 0; i < binaryString.length; i++) {
        credentialIdView[i] = binaryString.charCodeAt(i);
      }
      
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: challenge.buffer as ArrayBuffer,
        timeout: 60000,
        userVerification: "required",
        rpId: window.location.hostname,
        allowCredentials: [{
          id: credentialIdBuffer,
          type: "public-key",
          transports: ["internal"],
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
    } catch (error: any) {
      console.error("Biometric auth error:", error);
      
      if (error.name === "NotAllowedError") {
        toast({
          title: "Cancelled",
          description: "Biometric verification was cancelled.",
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
