import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, LifeBuoy, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const naira = (v: number) => "\u20a6" + Number(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 });

type Failed = {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  api_response: Record<string, unknown> | null;
  created_at: string;
  profile?: { id: string; full_name: string | null; phone_number: string | null; contact_email: string | null } | null;
};

const LOW_BALANCE = /insufficient|low balance|wallet balance|no fund|balance is/i;

export default function AdminRecovery() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Failed[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(true);
  const [active, setActive] = useState<Failed | null>(null);
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("We're sorry about your failed transaction");
  const [message, setMessage] = useState("");
  const [refund, setRefund] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("id, user_id, transaction_type, amount, description, api_response, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(200);
    const txns = (data ?? []) as Failed[];
    const ids = [...new Set(txns.map((t) => t.user_id))];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, user_id, full_name, phone_number, contact_email").in("user_id", ids)
      : { data: [] as any[] };
    const map = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    setRows(txns.map((t) => ({ ...t, profile: map.get(t.user_id) ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const isLowBalance = (t: Failed) => {
    const blob = JSON.stringify(t.api_response ?? {}) + " " + (t.description ?? "");
    return LOW_BALANCE.test(blob);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyLow && !isLowBalance(r)) return false;
      if (!s) return true;
      return [r.profile?.full_name, r.profile?.phone_number, r.profile?.contact_email, r.transaction_type, r.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s));
    });
  }, [rows, q, onlyLow]);

  const openDialog = (t: Failed) => {
    setActive(t);
    setChannel("email");
    setSubject("We're sorry about your failed transaction");
    setRefund(String(Number(t.amount) || ""));
    setMessage(
      `We're truly sorry — your ${t.transaction_type.replace("_", " ")} of ${naira(Number(t.amount))} did not go through because of a temporary issue on our side.\n\n` +
        `We have sorted it out and your wallet has been made whole. You can go ahead and retry the transaction now.\n\n` +
        `Thank you for your patience.`,
    );
  };

  const send = async () => {
    if (!active?.profile?.id) return;
    if (!message.trim()) {
      toast({ title: "Message is required", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-outreach", {
      body: {
        action: "recovery",
        profile_id: active.profile.id,
        transaction_id: active.id,
        channel,
        subject,
        message,
        refund_amount: Number(refund) || 0,
        reason: `Recovery for failed ${active.transaction_type}`,
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast({ title: "Could not send", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Recovery sent",
      description: (data as any)?.refunded ? `Refunded ${naira((data as any).refunded)} and notified the user.` : "User notified.",
    });
    setActive(null);
    load();
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <LifeBuoy className="h-4 w-4" /> Failed transaction recovery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, phone, service" className="h-9 pl-8" />
            </div>
            <Button size="sm" variant={onlyLow ? "default" : "outline"} onClick={() => setOnlyLow((v) => !v)}>
              {onlyLow ? "Wallet-low failures" : "All failures"}
            </Button>
          </div>

          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No failed transactions found.</p>
          )}
          {filtered.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {t.profile?.full_name || t.profile?.phone_number || t.user_id} · {t.transaction_type}
                </p>
                <p className="truncate text-muted-foreground">
                  {new Date(t.created_at).toLocaleString()} · {t.description || "No description"}
                </p>
              </div>
              {isLowBalance(t) && <Badge variant="destructive">Wallet low</Badge>}
              <span className="font-medium">{naira(Number(t.amount))}</span>
              <Button size="sm" variant="outline" onClick={() => openDialog(t)} disabled={!t.profile}>
                Recover
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Apologise & refund</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="both">Email + SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Message</Label>
              <Textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Refund to wallet (₦) — leave 0 to only send the message</Label>
              <Input type="number" min="0" value={refund} onChange={(e) => setRefund(e.target.value)} className="h-9" />
            </div>
            <Button onClick={send} disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send & refund
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
