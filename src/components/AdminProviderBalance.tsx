import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Server, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Admin-only widget that shows the CheapDataHub reseller wallet balance.
 * Hidden entirely for non-admins (admin role checked via has_role RPC).
 */
const AdminProviderBalance = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (cancelled) return;
      if (error) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(Boolean(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const fetchBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("vtu-service", {
        body: { action: "provider_wallet_balance" },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Failed to fetch balance");
      setBalance(Number(data.balance) || 0);
      setLastFetched(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast({
        title: "Could not fetch balance",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isAdmin !== true) return null;

  const lowBalance = balance !== null && balance < 5000;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            Provider Wallet (Admin)
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">CheapDataHub</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">Reseller balance</p>
          {balance === null && !error ? (
            <p className="text-sm text-muted-foreground mt-1">Tap refresh to fetch</p>
          ) : error ? (
            <p className="text-sm text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {error}
            </p>
          ) : (
            <p className={`text-2xl font-bold mt-1 ${lowBalance ? "text-destructive" : "text-foreground"}`}>
              ₦{(balance ?? 0).toLocaleString()}
            </p>
          )}
          {lastFetched && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Updated {lastFetched.toLocaleTimeString()}
            </p>
          )}
        </div>

        {lowBalance && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Low balance — fund the CheapDataHub wallet to avoid failed transactions.
          </p>
        )}

        <Button
          onClick={fetchBalance}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              {balance === null ? "Check balance" : "Refresh"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminProviderBalance;
