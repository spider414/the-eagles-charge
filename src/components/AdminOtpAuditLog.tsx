import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import RecordDetailDialog from "@/components/admin/RecordDetailDialog";

type AuditRow = {
  id: string;
  event_type: string;
  phone_hash: string;
  phone_hint: string | null;
  purpose: string | null;
  reason: string | null;
  metadata?: unknown;
  created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  send: "OTP sent",
  verify_success: "Verify success",
  verify_failure: "Verify failure",
};

export default function AdminOtpAuditLog() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("otp_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data as AuditRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!data) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      await load();
    };
    init();
  }, [user]);

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> OTP Audit Log
          </CardTitle>
          <CardDescription className="break-words">
            Last 50 OTP send and verification events. Phone numbers are stored hashed.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No OTP events recorded yet.</p>
        )}
        {rows.map((row) => (
          <button
            key={row.id}
            onClick={() => setDetail(row)}
            className="w-full rounded-md border p-3 text-left text-sm hover:bg-muted/50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  row.event_type === "verify_success"
                    ? "default"
                    : row.event_type === "verify_failure"
                    ? "destructive"
                    : "secondary"
                }
              >
                {EVENT_LABELS[row.event_type] ?? row.event_type}
              </Badge>
              {row.purpose && <span className="text-xs text-muted-foreground">{row.purpose}</span>}
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(row.created_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {row.phone_hint || "***"} · {row.phone_hash.slice(0, 12)}…
            </p>
            {row.reason && <p className="mt-1 break-words text-xs">{row.reason}</p>}
          </button>
        ))}
      </CardContent>
      <RecordDetailDialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail ? EVENT_LABELS[detail.event_type] ?? detail.event_type : ""}
        description={detail ? new Date(detail.created_at).toLocaleString() : undefined}
        raw={detail}
        fields={
          detail
            ? [
                { label: "Event", value: EVENT_LABELS[detail.event_type] ?? detail.event_type },
                { label: "Outcome", value: detail.event_type === "verify_failure" ? "Failed" : detail.event_type === "verify_success" ? "Verified" : "Code sent" },
                { label: "Purpose", value: detail.purpose },
                { label: "Phone hint", value: detail.phone_hint },
                { label: "Phone hash", value: detail.phone_hash },
                { label: "Reason", value: detail.reason },
                { label: "Metadata", value: detail.metadata },
                { label: "Recorded at", value: new Date(detail.created_at).toLocaleString() },
                { label: "Log id", value: detail.id },
              ]
            : []
        }
      />
    </Card>
  );
}
