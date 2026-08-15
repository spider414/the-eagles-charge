import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TransactGate = {
  allowed: boolean;
  reason: string | null;
};

const messages: Record<string, string> = {
  account_suspended: "Your account is suspended. Please contact support.",
  email_unverified: "Please verify your email address in Settings before you can recharge or subscribe.",
  profile_missing: "We could not load your profile. Please contact support.",
};

export const gateMessage = (reason: string | null | undefined) =>
  (reason && messages[reason]) || "You cannot make transactions right now.";

export function useCanTransact() {
  const { user } = useAuth();
  const [gate, setGate] = useState<TransactGate | null>(null);

  const check = useCallback(async () => {
    if (!user) {
      setGate(null);
      return;
    }
    const { data } = await supabase.rpc("can_transact", { _user_id: user.id });
    const row = Array.isArray(data) ? data[0] : data;
    setGate(row ? { allowed: !!row.allowed, reason: row.reason ?? null } : null);
  }, [user]);

  useEffect(() => {
    check();
  }, [check]);

  return { gate, refresh: check };
}
