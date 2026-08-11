import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { chargeTotal } from "@/lib/pricing";

interface WalletPaymentMetadata {
  transaction_type: "airtime" | "data" | "electricity" | "cable_tv" | "internet" | "exam_pin";
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
  exam_product_id?: number;
  exam_quantity?: number;
  exam_name?: string;
}

interface WalletPaymentParams {
  amount: number;
  metadata: WalletPaymentMetadata;
}

export const useWalletPayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, profile, refreshProfile } = useAuth();

  const payWithWallet = async ({ amount, metadata }: WalletPaymentParams): Promise<boolean> => {
    if (!user || !profile) {
      toast({
        title: "Authentication Required",
        description: "Please login to make a payment",
        variant: "destructive",
      });
      return false;
    }

    const walletBalance = profile.wallet_balance || 0;
    const total = chargeTotal(metadata.transaction_type, amount);

    if (walletBalance < total) {
      toast({
        title: "Insufficient Balance",
        description: `Your wallet balance (₦${walletBalance.toLocaleString()}) is less than ₦${total.toLocaleString()}`,
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Call edge function for real-time wallet payment processing via Paystack
      const { data, error } = await supabase.functions.invoke("paystack-payment", {
        body: {
          action: "wallet_payment",
          amount,
          metadata,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Payment processing failed");
      }

      await refreshProfile();

      toast({
        title: "Payment Successful",
        description: data.message || `₦${total.toLocaleString()} has been deducted from your wallet`,
      });

      return true;
    } catch (error) {
      console.error("Wallet payment error:", error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const canPayWithWallet = (amount: number): boolean => {
    return (profile?.wallet_balance || 0) >= amount;
  };

  return {
    payWithWallet,
    canPayWithWallet,
    isLoading,
    walletBalance: profile?.wallet_balance || 0,
  };
};
