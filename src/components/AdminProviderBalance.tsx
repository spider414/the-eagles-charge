import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const LOW_BALANCE = 5000;

const naira = (v: number) => `₦${v.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

/** Live CheapDataHub reseller wallet balance, admin only. */
export default function AdminProviderBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("vtu-service", {
        body: { action: "provider_wallet_balance" },
      });
      if (fnError || !data?.success) {
        setError(data?.error || fnError?.message || "Could not fetch provider balance");
      } else {
        setBalance(Number(data.balance) || 0);
        setError(null);
        setUpdatedAt(new Date());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fetch provider balance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const isLow = balance !== null && balance < LOW_BALANCE;

  return (
    <Card className={isLow ? "border-destructive/50" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Wallet className="h-4 w-4" /> CheapDataHub wallet
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={() => load()} disabled={loading} aria-label="Refresh balance">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <p className="text-2xl font-bold">
              {balance === null ? "—" : naira(balance)}
            </p>
            <p className="text-xs text-muted-foreground">
              {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · auto-refreshes every 60s` : "Loading…"}
            </p>
            {isLow && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Balance is below {naira(LOW_BALANCE)}. Top up now to avoid failed recharges.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
        <Button asChild size="sm" variant={isLow ? "destructive" : "default"} className="w-full">
          <a
            href="https://www.cheapdatahub.ng/user/fund-wallet/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Top up CheapDataHub wallet
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm" className="w-full">
          <a
            href="https://www.cheapdatahub.ng/user/wallet/"
            target="_blank"
            rel="noopener noreferrer"
          >
            View wallet history
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
