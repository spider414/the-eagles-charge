import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DepositFeeConfig {
  enabled: boolean;
  percent: number; // e.g. 1 = 1%
  loading: boolean;
}

const DEFAULTS = { enabled: true, percent: 1 };

/**
 * Live deposit (funding) fee settings, controlled by admins in /admin/deposit-fee.
 * Fetched at runtime so changes take effect without a new mobile build.
 */
export const useDepositFee = (): DepositFeeConfig => {
  const [config, setConfig] = useState<DepositFeeConfig>({ ...DEFAULTS, loading: true });

  useEffect(() => {
    let active = true;
    (async () => {
      // Public endpoint first (works for the Android shell without a rebuild),
      // falling back to a direct settings read.
      try {
        const { data, error } = await supabase.functions.invoke("deposit-fee", { body: {} });
        if (!error && data && typeof data.enabled === "boolean") {
          if (!active) return;
          setConfig({
            enabled: data.enabled,
            percent: Number.isFinite(Number(data.percent)) ? Number(data.percent) : DEFAULTS.percent,
            loading: false,
          });
          return;
        }
      } catch (_e) {
        // ignore and fall back
      }

      const { data } = await supabase
        .from("app_settings")
        .select("deposit_fee_enabled, deposit_fee_percent")
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setConfig({
        enabled: data ? data.deposit_fee_enabled !== false : DEFAULTS.enabled,
        percent: data && Number.isFinite(Number(data.deposit_fee_percent))
          ? Number(data.deposit_fee_percent)
          : DEFAULTS.percent,
        loading: false,
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  return config;
};
