import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const ACTION = "registration_bonus_setting_changed";

type Row = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  details: Record<string, unknown> | null;
};

type Change = {
  id: string;
  at: string;
  actor: string;
  enabledBefore: boolean | null;
  enabledAfter: boolean | null;
  amountBefore: number | null;
  amountAfter: number | null;
};

const bool = (v: unknown) => (typeof v === "boolean" ? v : null);
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export default function AdminBonusLog() {
  const { formatCurrency, formatDateTime } = useLanguage();
  const [rows, setRows] = useState<Change[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_activity_log")
      .select("id, created_at, actor_user_id, details")
      .eq("action", ACTION)
      .order("created_at", { ascending: false })
      .limit(200);

    const mapped: Change[] = ((data ?? []) as Row[]).map((r) => {
      const d = (r.details ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        at: r.created_at,
        actor: r.actor_user_id ?? "system",
        enabledBefore: bool(d.enabled_before),
        enabledAfter: bool(d.enabled_after),
        amountBefore: num(d.amount_before),
        amountAfter: num(d.amount_after),
      };
    });

    const actorIds = [...new Set(mapped.map((m) => m.actor).filter((a) => a !== "system"))];
    if (actorIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone_number")
        .in("user_id", actorIds);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p) => {
        map[p.user_id] = p.full_name || p.phone_number || p.user_id;
      });
      setNames(map);
    }

    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const term = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      rows.filter((r) =>
        !term
          ? true
          : [r.actor, names[r.actor], r.amountBefore, r.amountAfter, r.at]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(term),
      ),
    [rows, term, names],
  );

  const state = (v: boolean | null) =>
    v === null ? <span className="text-muted-foreground">—</span> : (
      <Badge variant={v ? "default" : "secondary"}>{v ? "ON" : "OFF"}</Badge>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Gift className="h-5 w-5" /> Registration bonus audit log
          </h1>
          <p className="text-sm text-muted-foreground">
            Every change to the signup bonus setting, with the admin who made it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <Input placeholder="Search by admin or amount…" value={q} onChange={(e) => setQ(e.target.value)} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Changes</CardTitle>
          <CardDescription>{visible.length} record(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && visible.length === 0 && (
            <p className="text-sm text-muted-foreground">No registration bonus changes recorded yet.</p>
          )}
          {visible.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3 text-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{names[r.actor] ?? r.actor}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(r.at)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Status:</span>
                {state(r.enabledBefore)}
                <span className="text-muted-foreground">→</span>
                {state(r.enabledAfter)}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-mono">{r.amountBefore === null ? "—" : formatCurrency(r.amountBefore)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono font-semibold">
                  {r.amountAfter === null ? "—" : formatCurrency(r.amountAfter)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono break-all">Admin ID: {r.actor}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
