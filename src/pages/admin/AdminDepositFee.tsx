import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FeeEntry {
  id: string;
  created_at: string;
  method: string;
  reference: string | null;
  gross_amount: number;
  fee_percent: number;
  fee_amount: number;
  net_amount: number;
}

const naira = (n: number) => `₦${Number(n || 0).toLocaleString()}`;

export default function AdminDepositFee() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [percent, setPercent] = useState("1");
  const [entries, setEntries] = useState<FeeEntry[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: logs }] = await Promise.all([
      supabase
        .from("app_settings")
        .select("id, deposit_fee_enabled, deposit_fee_percent")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("deposit_fee_log")
        .select("id, created_at, method, reference, gross_amount, fee_percent, fee_amount, net_amount")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    if (error) {
      toast({ title: "Could not load settings", description: error.message, variant: "destructive" });
    } else if (data) {
      setId(data.id);
      setEnabled(data.deposit_fee_enabled);
      setPercent(String(Number(data.deposit_fee_percent)));
    }
    setEntries((logs as FeeEntry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const value = Number(percent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      toast({ title: "Invalid percentage", description: "Enter a value between 0 and 100.", variant: "destructive" });
      return;
    }
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ deposit_fee_enabled: enabled, deposit_fee_percent: value })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Deposit fee settings updated instantly for all users." });
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Deposit (funding) fee</CardTitle>
              <CardDescription>
                Applies to every deposit — bank transfers, card top-ups and manual reconciliation.
                Changes take effect immediately, no new app build needed.
              </CardDescription>
            </div>
            {!loading && <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "ON" : "OFF"}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Charge deposit fee</p>
                  <p className="text-xs text-muted-foreground">Turn off to credit deposits in full.</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="percent">Fee percentage (%)</Label>
                <Input
                  id="percent"
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  disabled={!enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Example: at {Number(percent) || 0}%, a {naira(15000)} deposit is charged{" "}
                  {naira(Math.ceil((15000 * (Number(percent) || 0)) / 100))} and credits{" "}
                  {naira(15000 - Math.ceil((15000 * (Number(percent) || 0)) / 100))}.
                </p>
              </div>

              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save settings
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent deposit fee ledger</CardTitle>
          <CardDescription>Every credited deposit writes one entry here.</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deposits recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <div key={e.id} className="rounded-lg border border-border p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{e.method.replace("_", " ")}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="font-mono break-all text-muted-foreground">{e.reference ?? "—"}</p>
                  <p>
                    Received {naira(e.gross_amount)} · fee {naira(e.fee_amount)} ({e.fee_percent}%) ·
                    credited <span className="font-semibold">{naira(e.net_amount)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
