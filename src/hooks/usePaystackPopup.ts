import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface PaystackMetadata {
  transaction_type: "airtime" | "data" | "electricity" | "cable_tv" | "internet" | "wallet_topup";
  phone_number?: string;
  network?: string;
  data_plan?: string;
  electricity_provider?: string;
  meter_number?: string;
  meter_type?: string;
  cable_provider?: string;
  cable_smartcard?: string;
  cable_plan?: string;
  internet_plan?: string;
  account_number?: string;
}

interface InitializePaymentParams {
  amount: number;
  email: string;
  metadata: PaystackMetadata;
  onSuccess?: (reference: string) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

// Load Paystack inline script
const loadPaystackScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack script"));
    document.head.appendChild(script);
  });
};

export const usePaystackPopup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { session, refreshProfile } = useAuth();

  const initializePayment = useCallback(
    async ({ amount, email, metadata, onSuccess, onClose }: InitializePaymentParams) => {
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please login to make a payment",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);

      try {
        // Load Paystack script if not already loaded
        await loadPaystackScript();

        // Get initialization data from our backend (reference, public key)
        const { data, error } = await supabase.functions.invoke("paystack-payment", {
          body: {
            action: "initialize",
            amount,
            email,
            metadata,
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data.success) {
          throw new Error(data.error || "Failed to initialize payment");
        }

        // Use Paystack popup instead of redirect
        if (!data.public_key) {
          throw new Error("Payment configuration missing (public key)");
        }

        const handler = window.PaystackPop.setup({
          key: data.public_key,
          email,
          amount: amount * 100, // Paystack expects amount in kobo
          ref: data.reference,
          metadata: {
            custom_fields: Object.entries(metadata).map(([key, value]) => ({
              display_name: key,
              variable_name: key,
              value: String(value ?? ""),
            })),
          },
          // Paystack's validator doesn't accept async functions here.
          callback: (response) => {
            void (async () => {
              console.log("Payment successful:", response.reference);

              try {
                const verifyResult = await supabase.functions.invoke("paystack-payment", {
                  body: {
                    action: "verify",
                    reference: response.reference,
                  },
                });

                if (verifyResult.data?.success) {
                  toast({
                    title: "Payment Successful!",
                    description: `₦${amount.toLocaleString()} has been added to your wallet`,
                  });
                  refreshProfile();
                  onSuccess?.(response.reference);
                } else {
                  toast({
                    title: "Verification Failed",
                    description: "Payment was made but verification failed. Please contact support.",
                    variant: "destructive",
                  });
                }
              } catch (verifyError) {
                console.error("Verification error:", verifyError);
                toast({
                  title: "Verification Error",
                  description: "Could not verify payment. Please check your balance.",
                  variant: "destructive",
                });
              } finally {
                setIsLoading(false);
              }
            })();
          },
          onClose: () => {
            console.log("Payment popup closed");
            setIsLoading(false);
            onClose?.();
          },
        });

        handler.openIframe();
      } catch (error) {
        console.error("Payment initialization error:", error);
        toast({
          title: "Payment Failed",
          description: error instanceof Error ? error.message : "Something went wrong",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    },
    [session, toast, refreshProfile]
  );

  return {
    initializePayment,
    isLoading,
  };
};
