import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CustomerInfo {
  customer_name: string;
  account_id?: string;
}

interface VerificationResult {
  valid: boolean;
  error?: string;
  customer_name?: string;
  account_id?: string;
}

export const useInternetVerification = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const verifyAccount = useCallback(async (
    accountNumber: string,
    provider: string
  ): Promise<boolean> => {
    if (!accountNumber || accountNumber.length < 5) {
      setCustomerInfo(null);
      setVerificationError(null);
      return false;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setCustomerInfo(null);

    try {
      const { data, error } = await supabase.functions.invoke<VerificationResult>(
        "verify-internet",
        {
          body: {
            account_number: accountNumber,
            provider,
          },
        }
      );

      if (error) {
        console.error("Verification error:", error);
        setVerificationError("Failed to verify account. Please try again.");
        return false;
      }

      if (data?.valid) {
        setCustomerInfo({
          customer_name: data.customer_name || "Unknown",
          account_id: data.account_id,
        });
        setVerificationError(null);
        return true;
      } else {
        setVerificationError(data?.error || "Invalid account number");
        setCustomerInfo(null);
        return false;
      }
    } catch (err) {
      console.error("Verification error:", err);
      setVerificationError("Failed to verify account. Please try again.");
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
    verifyAccount,
    resetVerification,
  };
};
