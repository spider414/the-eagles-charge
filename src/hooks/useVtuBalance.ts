import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VtuBalanceData {
  balance: number;
  currency: string;
  lastChecked: Date;
}

export const useVtuBalance = () => {
  const [balance, setBalance] = useState<VtuBalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const checkBalance = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke("vtu-service", {
        body: { action: "balance" },
      });

      if (fetchError) throw fetchError;

      if (data.success) {
        const balanceData: VtuBalanceData = {
          balance: parseFloat(data.data.balance) || 0,
          currency: data.data.currency || "NGN",
          lastChecked: new Date(),
        };
        setBalance(balanceData);
        setError(null);
        
        // Check for low balance alert (threshold: ₦5,000)
        if (balanceData.balance < 5000) {
          toast({
            title: "⚠️ Low VTU Balance",
            description: `Your VTU balance is ₦${balanceData.balance.toLocaleString()}. Consider topping up.`,
            variant: "destructive",
          });
        }
        
        return balanceData;
      } else {
        throw new Error(data.error || "Failed to check balance");
      }
    } catch (err) {
      console.error("VTU balance check error:", err);
      const errorMessage = err instanceof Error ? err.message : "Could not fetch VTU balance";
      setError(errorMessage);
      toast({
        title: "Balance Check Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    balance,
    isLoading,
    error,
    checkBalance,
  };
};
