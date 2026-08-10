import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Entry = {
  id: string;
  at: string;
  source: "role" | "email" | "otp";
  action: string;
  actor: string | null;
  target: string | null;
  detail: string;
};

const SOURCES: { key: "all" | Entry["source"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "role", label: "Roles" },
  { key: "email", label: "Emails" },
  { key: "otp", label: "OTP" },
];

export default function AdminActivity() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"all" | Entry["source"]>("all");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const [roles, emails, otps] = await Promise.all([
      supabase.from("admin_activity_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("email_send_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("otp_audit_log").select("*").order("created_at", { ascending: false }).limit(200),
    ]);

    const merged: Entry[] = [
      ...(roles.data ?? []).map((r) => ({
        id: `role-${r.id}`,
        at: r.created_at,
        source: "role" as const,
        action: r.action,
        actor: r.actor_user_id,
        target: r.target_user_id,
        detail: JSON.stringify(r.details ?? {}),
      })),
      ...(emails.data ?? []).map((r) => ({
        id: `email-${r.id}`,
        at: r.created_at,
        source: "email" as const,
        action: `email_${r.status}`,
        actor: null,
        target: r.recipient_email,
        detail: [r.template_type, r.subject, r.skipped_reason, r.error_message].filter(Boolean).join(" · "),
      })),
      ...(otps.data ?? []).map((r) => ({
        id: `otp-${r.id}`,
        at: r.created_at,
        source: "otp" as const,
        action: r.event_type,
        actor: null,
        target: r.phone_hint ?? r.phone_hash.slice(0, 10),
        detail: [r.purpose, r.reason].filter(Boolean).join(" · "),
      })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1));

    setEntries(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const term = q.trim().toLowerCase();
  const visible = entries.filter(
    (e) =>
      (source === "all" || e.source === source) &&
      (!term ||
        [e.action, e.actor, e.target, e.detail].some((v) => (v ?? "").toLowerCase().includes(term))),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm">Activity log</CardTitle>
        <Button variant="ghost" size="icon" onClick={load} aria-label="Refresh activity log">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {SOURCES.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={source === s.key ? "default" : "outline"}
              onClick={() => setSource(s.key)}
            >
              {s.label}
            </Button>
          ))}
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search action, user id, recipient…"
            className="h-8 w-full sm:w-64"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {visible.map((e) => (
              <div key={e.id} className="rounded-md border border-border p-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">{e.source}</Badge>
                  <span className="font-medium">{e.action}</span>
                  <span className="ml-auto text-muted-foreground">
                    {new Date(e.at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 break-all text-muted-foreground">
                  {e.actor ? `actor: ${e.actor} · ` : ""}
                  {e.target ? `target: ${e.target}` : ""}
                </p>
                {e.detail && <p className="mt-0.5 break-all text-muted-foreground">{e.detail}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
