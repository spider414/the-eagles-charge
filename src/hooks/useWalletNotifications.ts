import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook that listens for real-time wallet credits and shows notifications
 * when funds are added via bank transfer or other methods
 */
export const useWalletNotifications = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const previousBalanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !profile) return;

    // Store initial balance
    previousBalanceRef.current = profile.wallet_balance ?? 0;

    // Subscribe to profile changes for wallet balance updates
    const profileChannel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newBalance = (payload.new as any).wallet_balance;
          const oldBalance = previousBalanceRef.current ?? 0;

          if (newBalance > oldBalance) {
            const creditAmount = newBalance - oldBalance;
            
            // Show success notification
            toast({
              title: "💰 Wallet Credited!",
              description: `₦${creditAmount.toLocaleString()} has been added to your wallet. New balance: ₦${newBalance.toLocaleString()}`,
              duration: 8000,
            });

            // Play notification sound if available
            try {
              if ("vibrate" in navigator) {
                navigator.vibrate([200, 100, 200]);
              }
            } catch (e) {
              // Vibration not supported
            }

            // Refresh profile to update UI
            await refreshProfile();
          }

          previousBalanceRef.current = newBalance;
        }
      )
      .subscribe();

    // Subscribe to new completed transactions
    const transactionChannel = supabase
      .channel(`transactions-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const transaction = payload.new as any;
          
          // Notify for completed wallet top-ups via bank transfer
          if (
            transaction.transaction_type === "wallet_topup" &&
            transaction.status === "completed"
          ) {
            toast({
              title: "✅ Transfer Received",
              description: `Bank transfer of ₦${transaction.amount?.toLocaleString()} has been credited to your wallet.`,
              duration: 6000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(transactionChannel);
    };
  }, [user, profile?.wallet_balance, refreshProfile, toast]);
};
