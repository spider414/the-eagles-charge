import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/**
 * Hook that listens for real-time wallet credits and transaction updates,
 * shows in-app notifications, and auto-subscribes to push notifications.
 */
export const useWalletNotifications = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const previousBalanceRef = useRef<number | null>(null);
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();

  // Auto-subscribe to push on first load if permission granted
  useEffect(() => {
    if (user && isSupported && !isSubscribed && Notification.permission === "granted") {
      subscribe();
    }
  }, [user, isSupported, isSubscribed, subscribe]);

  useEffect(() => {
    if (!user || !profile) return;

    previousBalanceRef.current = profile.wallet_balance ?? 0;

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

            toast({
              title: "💰 Wallet Credited!",
              description: `₦${creditAmount.toLocaleString()} has been added to your wallet. New balance: ₦${newBalance.toLocaleString()}`,
              duration: 8000,
            });

            try {
              if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
            } catch {}

            await refreshProfile();
          }

          previousBalanceRef.current = newBalance;
        }
      )
      .subscribe();

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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const tx = payload.new as any;
          const oldTx = payload.old as any;

          // Notify when a transaction status changes to completed or failed
          if (oldTx.status !== tx.status && (tx.status === "completed" || tx.status === "failed")) {
            const emoji = tx.status === "completed" ? "✅" : "❌";
            const desc = tx.description || tx.transaction_type;
            toast({
              title: `${emoji} ${desc}`,
              description: tx.status === "completed"
                ? `Your ${desc} of ₦${tx.amount?.toLocaleString()} was successful.`
                : `Your ${desc} of ₦${tx.amount?.toLocaleString()} failed. Check your history for details.`,
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
