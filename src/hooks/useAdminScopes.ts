import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const ADMIN_SCOPES = [
  { key: "all", label: "General admin (everything)" },
  { key: "users", label: "Users & wallets" },
  { key: "recovery", label: "Failed transaction recovery" },
  { key: "campaigns", label: "Campaigns & messaging" },
  { key: "email", label: "Email branding & templates" },
  { key: "verification", label: "NIN / identity verification" },
  { key: "finance", label: "Billing, reconciliation & fees" },
  { key: "logs", label: "Audit & activity logs" },
] as const;

export type AdminScope = (typeof ADMIN_SCOPES)[number]["key"];

export const scopeLabel = (key: string) =>
  ADMIN_SCOPES.find((s) => s.key === key)?.label ?? key;

/** Scopes for the signed-in admin. `isSuper` means they can manage other admins. */
export function useAdminScopes() {
  const { user, isLoading } = useAuth();
  const [scopes, setScopes] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isLoading) return;
    if (!user) {
      setScopes([]);
      return;
    }
    supabase
      .from("admin_scopes")
      .select("scope")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!cancelled) setScopes((data ?? []).map((r: { scope: string }) => r.scope));
      });
    return () => {
      cancelled = true;
    };
  }, [user, isLoading]);

  const isSuper = !!scopes?.includes("all");
  return {
    scopes: scopes ?? [],
    loading: scopes === null,
    isSuper,
    can: (scope: string) => isSuper || !!scopes?.includes(scope),
  };
}
