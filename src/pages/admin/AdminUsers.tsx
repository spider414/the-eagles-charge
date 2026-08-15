import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MailCheck, MailWarning, Search, Send, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
const formatNaira = (v: number) =>
  "\u20a6" + Number(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Row = {
  id: string;
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  contact_email: string | null;
  email: string | null;
  wallet_balance: number | null;
  contact_email_verified: boolean | null;
  created_at: string;
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [remindBusy, setRemindBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, user_id, full_name, phone_number, contact_email, email, wallet_balance, contact_email_verified, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const term = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          !term ||
          [r.full_name, r.phone_number, r.contact_email, r.email, r.user_id].some((v) =>
            (v ?? "").toLowerCase().includes(term),
          ),
      ),
    [rows, term],
  );

  const totalBalance = rows.reduce((s, r) => s + Number(r.wallet_balance ?? 0), 0);
  const unverified = rows.filter((r) => !r.contact_email_verified);

  const remindUnverified = async () => {
    setRemindBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-outreach", {
      body: { action: "verify_reminder", channel: "push" },
    });
    setRemindBusy(false);
    if (error || data?.error) {
      toast({ title: "Could not send reminders", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Reminders sent",
      description: `${data?.notified ?? 0} user(s) got an app notification to verify their email.`,
    });
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" /> Registered users ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Combined wallet balance: <span className="font-medium">{formatNaira(totalBalance)}</span>
          </p>
          {unverified.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-muted/40 p-2.5">
              <MailWarning className="h-4 w-4 text-destructive" />
              <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                {unverified.length} user(s) have not verified their email — they cannot recharge or subscribe until
                they do.
              </p>
              <Button size="sm" disabled={remindBusy} onClick={remindUnverified}>
                {remindBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                Remind them all
              </Button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, email or user id"
              className="h-9 pl-8"
            />
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/admin/users/${r.id}`)}
                  className="flex w-full items-center gap-2 rounded-md border border-border p-2.5 text-left text-xs hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.full_name || r.phone_number || "Unnamed user"}</p>
                    <p className="truncate text-muted-foreground">
                      {r.phone_number || r.contact_email || r.email || r.user_id}
                    </p>
                  </div>
                  {r.contact_email_verified ? (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <MailCheck className="h-3 w-3" /> Verified
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1 text-[10px]">
                      <MailWarning className="h-3 w-3" /> Unverified
                    </Badge>
                  )}
                  <Badge variant="secondary">{formatNaira(Number(r.wallet_balance ?? 0))}</Badge>
                </button>
              ))}
              {visible.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No users found.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
