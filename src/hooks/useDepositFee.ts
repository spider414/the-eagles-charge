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
