import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CustomerInfo {
  customer_name: string;
  current_package?: string;
  due_date?: string;
}

interface VerificationResult {
  valid: boolean;
  error?: string;
  customer_name?: string;
  current_package?: string;
  due_date?: string;
}

export const useSmartcardVerification = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const { toast } = useToast();

  const verifySmartcard = useCallback(async (
    smartcardNumber: string,
    provider: "dstv" | "gotv" | "startimes"
  ): Promise<boolean> => {
    if (!smartcardNumber || smartcardNumber.length < 10) {
      setCustomerInfo(null);
      setVerificationError(null);
      return false;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setCustomerInfo(null);

    try {
      const { data, error } = await supabase.functions.invoke<VerificationResult>(
        "verify-smartcard",
        {
          body: {
            smartcard_number: smartcardNumber,
            provider,
          },
        }
      );

      if (error) {
        console.error("Verification error:", error);
        setVerificationError("Failed to verify smartcard. Please try again.");
        return false;
      }

      if (data?.valid) {
        setCustomerInfo({
          customer_name: data.customer_name || "Unknown",
          current_package: data.current_package,
          due_date: data.due_date,
        });
        setVerificationError(null);
        return true;
      } else {
        setVerificationError(data?.error || "Invalid smartcard number");
        setCustomerInfo(null);
        return false;
      }
    } catch (err) {
      console.error("Verification error:", err);
      setVerificationError("Failed to verify smartcard. Please try again.");
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  const resetVerification = useCallback(() => {
    setCustomerInfo(null);
    setVerificationError(null);
  }, []);

  return {
    isVerifying,
    customerInfo,
    verificationError,
    verifySmartcard,
    resetVerification,
  };
};
