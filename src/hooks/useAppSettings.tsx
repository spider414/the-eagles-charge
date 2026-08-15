import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FeatureFlags = Record<string, boolean>;

export type AppSettings = {
  id: string | null;
  registrationBonusEnabled: boolean;
  registrationBonusAmount: number;
  depositFeeEnabled: boolean;
  depositFeePercent: number;
  ninVerificationRequired: boolean;
  featureFlags: FeatureFlags;
};

export const DEFAULT_FLAGS: FeatureFlags = {
  airtime_enabled: true,
  data_enabled: true,
  cable_enabled: true,
  electricity_enabled: true,
  internet_enabled: true,
  exam_pin_enabled: true,
  wallet_topup_enabled: true,
  referrals_enabled: true,
  support_chat_enabled: true,
  maintenance_mode: false,
};

const DEFAULTS: AppSettings = {
  id: null,
  registrationBonusEnabled: true,
  registrationBonusAmount: 2000,
  depositFeeEnabled: true,
  depositFeePercent: 1,
  ninVerificationRequired: false,
  featureFlags: DEFAULT_FLAGS,
};

type Ctx = AppSettings & {
  loading: boolean;
  refresh: () => Promise<void>;
  isEnabled: (flag: string) => boolean;
};

const AppSettingsContext = createContext<Ctx>({
  ...DEFAULTS,
  loading: true,
  refresh: async () => {},
  isEnabled: () => true,
});

const POLL_MS = 30_000;

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select(
        "id, registration_bonus_enabled, registration_bonus_amount, deposit_fee_enabled, deposit_fee_percent, nin_verification_required, feature_flags",
      )
      .limit(1)
      .maybeSingle();

    if (!mounted.current || !data) return;
    const raw = (data.feature_flags ?? {}) as Record<string, unknown>;
    const flags: FeatureFlags = { ...DEFAULT_FLAGS };
    for (const [k, v] of Object.entries(raw)) flags[k] = v === true;

    setSettings({
      id: data.id,
      registrationBonusEnabled: !!data.registration_bonus_enabled,
      registrationBonusAmount: Number(data.registration_bonus_amount ?? 0),
      depositFeeEnabled: !!data.deposit_fee_enabled,
      depositFeePercent: Number(data.deposit_fee_percent ?? 0),
      ninVerificationRequired: !!data.nin_verification_required,
      featureFlags: flags,
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh().finally(() => mounted.current && setLoading(false));

    // instant updates while the app is open
    const channel = supabase
      .channel("app-settings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => {
        refresh();
      })
      .subscribe();

    // background polling fallback (realtime can drop on mobile networks)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({
      ...settings,
      loading,
      refresh,
      isEnabled: (flag: string) => settings.featureFlags[flag] !== false,
    }),
    [settings, loading, refresh],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}

export function useFeatureFlag(flag: string) {
  return useAppSettings().isEnabled(flag);
}
