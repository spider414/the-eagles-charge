import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface WalletPaymentMetadata {
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
    
    if (walletBalance < amount) {
      toast({
        title: "Insufficient Balance",
        description: `Your wallet balance (₦${walletBalance.toLocaleString()}) is less than ₦${amount.toLocaleString()}`,
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          transaction_type: metadata.transaction_type,
          amount: amount,
          status: "processing",
          phone_number: metadata.phone_number,
          network: metadata.network as "mtn" | "glo" | "airtel" | "9mobile" | undefined,
          data_plan: metadata.data_plan,
          electricity_provider: metadata.electricity_provider as any,
          meter_number: metadata.meter_number,
          meter_type: metadata.meter_type,
          cable_provider: metadata.cable_provider as "dstv" | "gotv" | "startimes" | undefined,
          cable_smartcard: metadata.cable_smartcard,
          cable_plan: metadata.cable_plan,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Deduct from wallet
      const newBalance = walletBalance - amount;
      const { error: walletError } = await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance })
        .eq("id", profile.id);

      if (walletError) throw walletError;

      // Update transaction to completed (in real app, this would happen after API call to provider)
      await supabase
        .from("transactions")
        .update({ status: "completed" })
        .eq("id", transaction.id);

      await refreshProfile();

      toast({
        title: "Payment Successful",
        description: `₦${amount.toLocaleString()} has been deducted from your wallet`,
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
