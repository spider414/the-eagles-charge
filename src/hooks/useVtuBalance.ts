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
  const { toast } = useToast();

  const checkBalance = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("vtu-service", {
        body: { action: "balance" },
      });

      if (error) throw error;

      if (data.success) {
        const balanceData: VtuBalanceData = {
          balance: parseFloat(data.data.balance) || 0,
          currency: data.data.currency || "NGN",
          lastChecked: new Date(),
        };
        setBalance(balanceData);
        
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
    } catch (error) {
      console.error("VTU balance check error:", error);
      toast({
        title: "Balance Check Failed",
        description: error instanceof Error ? error.message : "Could not fetch VTU balance",
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
    checkBalance,
  };
};
