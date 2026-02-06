import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CustomerInfo {
  customer_name: string;
  customer_address?: string;
  outstanding_balance?: string;
}

interface VerificationResult {
  valid: boolean;
  error?: string;
  customer_name?: string;
  customer_address?: string;
  outstanding_balance?: string;
}

export const useMeterVerification = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const verifyMeter = useCallback(async (
    meterNumber: string,
    provider: string,
    meterType: "prepaid" | "postpaid"
  ): Promise<boolean> => {
    if (!meterNumber || meterNumber.length < 10) {
      setCustomerInfo(null);
      setVerificationError(null);
      return false;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setCustomerInfo(null);

    try {
      const { data, error } = await supabase.functions.invoke<VerificationResult>(
        "verify-meter",
        {
          body: {
            meter_number: meterNumber,
            provider,
            meter_type: meterType,
          },
        }
      );

      if (error) {
        console.error("Verification error:", error);
        setVerificationError("Failed to verify meter. Please try again.");
        return false;
      }

      if (data?.valid) {
        setCustomerInfo({
          customer_name: data.customer_name || "Unknown",
          customer_address: data.customer_address,
          outstanding_balance: data.outstanding_balance,
        });
        setVerificationError(null);
        return true;
      } else {
        setVerificationError(data?.error || "Invalid meter number");
        setCustomerInfo(null);
        return false;
      }
    } catch (err) {
      console.error("Verification error:", err);
      setVerificationError("Failed to verify meter. Please try again.");
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
    verifyMeter,
    resetVerification,
  };
};
