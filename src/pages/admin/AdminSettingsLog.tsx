import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const ACTIONS = ["app_settings_updated", "feature_flag_changed"];

type Row = {
  id: string;
  created_at: string;
  action: string;
  actor_user_id: string | null;
  details: Record<string, any> | null;
};

type Diff = { field: string; before: string; after: string };

const show = (v: unknown) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "ON" : "OFF";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

function diffsFor(row: Row): Diff[] {
  const d = row.details ?? {};
  if (row.action === "feature_flag_changed") {
    const changes = (d.changes ?? {}) as Record<string, { before: unknown; after: unknown }>;
    return Object.entries(changes).map(([field, c]) => ({
      field,
      before: show(c?.before),
      after: show(c?.after),
    }));
  }
  const before = (d.before ?? {}) as Record<string, unknown>;
  const after = (d.after ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ field: k, before: show(before[k]), after: show(after[k]) }));
}

export default function AdminSettingsLog() {
  const { formatDateTime } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_activity_log")
      .select("id, created_at, action, actor_user_id, details")
      .in("action", ACTIONS)
      .order("created_at", { ascending: false })
      .limit(200);

    const list = (data ?? []) as Row[];
    setRows(list);

    const ids = Array.from(new Set(list.map((r) => r.actor_user_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone_number")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      for (const p of profiles ?? []) {
        map[p.user_id] = p.full_name || p.phone_number || p.user_id;
      }
      setNames(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const withDiffs = rows
      .map((r) => ({ row: r, diffs: diffsFor(r) }))
      .filter((x) => x.diffs.length > 0);
    if (!term) return withDiffs;
    return withDiffs.filter(
      (x) =>
        x.diffs.some((d) => d.field.toLowerCase().includes(term)) ||
        (names[x.row.actor_user_id ?? ""] ?? "").toLowerCase().includes(term),
    );
  }, [rows, q, names]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <History className="h-5 w-5" /> Settings change log
          </h1>
          <p className="text-sm text-muted-foreground">Who changed what, and when.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Input placeholder="Search by field or admin…" value={q} onChange={(e) => setQ(e.target.value)} />

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No settings changes recorded yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ row, diffs }) => (
            <Card key={row.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex flex-wrap items-center gap-2">
                  <Badge variant={row.action === "feature_flag_changed" ? "default" : "secondary"}>
                    {row.action === "feature_flag_changed" ? "Feature flag" : "App setting"}
                  </Badge>
                  <span className="font-normal">{names[row.actor_user_id ?? ""] ?? "System"}</span>
                </CardTitle>
                <CardDescription>{formatDateTime(row.created_at)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {diffs.map((d) => (
                  <div key={d.field} className="text-xs flex flex-wrap items-center gap-2">
                    <span className="font-mono text-muted-foreground">{d.field}</span>
                    <span className="line-through opacity-70">{d.before}</span>
                    <span>→</span>
                    <span className="font-semibold">{d.after}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
