import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SignupBonus {
  enabled: boolean;
  amount: number;
}

/**
 * Reads the live registration bonus config from the backend so no screen has to
 * hard-code an amount. Falls back to "disabled" if the endpoint is unreachable.
 */
export function useSignupBonus() {
  const [bonus, setBonus] = useState<SignupBonus>({ enabled: false, amount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("signup-bonus");
        if (!cancelled && data) {
          setBonus({ enabled: !!data.enabled, amount: Number(data.amount) || 0 });
        }
      } catch {
        /* keep the safe default */
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...bonus, isLoading };
}
