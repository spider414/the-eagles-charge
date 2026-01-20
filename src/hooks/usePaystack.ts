import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface PaystackMetadata {
  transaction_type: "airtime" | "data" | "electricity" | "cable_tv" | "internet";
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
}

export const usePaystack = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { session } = useAuth();

  const initializePayment = async ({ amount, email, metadata }: InitializePaymentParams) => {
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

      // Redirect to Paystack checkout
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (error) {
      console.error("Payment initialization error:", error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPayment = async (reference: string) => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("paystack-payment", {
        body: {
          action: "verify",
          reference,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error("Payment verification error:", error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Could not verify payment",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    initializePayment,
    verifyPayment,
    isLoading,
  };
};
