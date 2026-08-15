import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ToggleLeft, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings, DEFAULT_FLAGS } from "@/hooks/useAppSettings";

const LABELS: Record<string, string> = {
  airtime_enabled: "Airtime purchases",
  data_enabled: "Data bundles",
  cable_enabled: "Cable TV",
  electricity_enabled: "Electricity bills",
  internet_enabled: "Internet plans",
  exam_pin_enabled: "Exam PINs",
  wallet_topup_enabled: "Wallet top-up",
  referrals_enabled: "Referral programme",
  support_chat_enabled: "Support chat",
  maintenance_mode: "Maintenance mode (blocks the app)",
};

export default function AdminFeatureFlags() {
  const { toast } = useToast();
  const { refresh } = useAppSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({ ...DEFAULT_FLAGS });
  const [newKey, setNewKey] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("id, feature_flags")
      .limit(1)
      .maybeSingle();
    if (error) {
      toast({ title: "Could not load flags", description: error.message, variant: "destructive" });
    } else if (data) {
      setId(data.id);
      const raw = (data.feature_flags ?? {}) as Record<string, unknown>;
      const next: Record<string, boolean> = { ...DEFAULT_FLAGS };
      for (const [k, v] of Object.entries(raw)) next[k] = v === true;
      setFlags(next);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (next: Record<string, boolean>) => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").update({ feature_flags: next }).eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      load();
      return;
    }
    toast({ title: "Saved", description: "Change is live for every user immediately." });
    refresh();
  };

  const toggle = (key: string, value: boolean) => {
    const next = { ...flags, [key]: value };
    setFlags(next);
    save(next);
  };

  const addFlag = () => {
    const key = newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!key) return;
    if (flags[key] !== undefined) {
      toast({ title: "Flag already exists", variant: "destructive" });
      return;
    }
    const next = { ...flags, [key]: true };
    setFlags(next);
    setNewKey("");
    save(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ToggleLeft className="h-5 w-5" /> Live feature flags
          </h1>
          <p className="text-sm text-muted-foreground">
            Toggle app behaviour instantly — no new Play Store release needed.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flags</CardTitle>
          <CardDescription>Changes reach open apps within seconds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            Object.keys(flags)
              .sort()
              .map((key) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{LABELS[key] ?? key}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{key}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={flags[key] ? "default" : "secondary"}>{flags[key] ? "ON" : "OFF"}</Badge>
                    <Switch checked={flags[key]} disabled={saving} onCheckedChange={(v) => toggle(key, v)} />
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a new flag</CardTitle>
          <CardDescription>Use lowercase words with underscores, e.g. promo_banner_enabled.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="flagkey" className="sr-only">
              Flag key
            </Label>
            <Input
              id="flagkey"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="promo_banner_enabled"
            />
          </div>
          <Button onClick={addFlag} disabled={saving || !newKey.trim()}>
            <Plus className="h-4 w-4 mr-2" /> Add flag
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
