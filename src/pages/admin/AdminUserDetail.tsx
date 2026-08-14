import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, MinusCircle, PlusCircle, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const naira = (v: number) =>
  "\u20a6" + Number(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
  contact_email: string | null;
  wallet_balance: number | null;
  referral_code: string | null;
  total_referral_earnings: number | null;
  phone_verified: boolean | null;
  dva_account_number: string | null;
  dva_bank_name: string | null;
  created_at: string;
};

type Txn = {
  id: string;
  transaction_type: string;
  status: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: p } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    setProfile((p as Profile) ?? null);
    if (p?.user_id) {
      const { data: t } = await supabase
        .from("transactions")
        .select("id, transaction_type, status, amount, description, created_at")
        .eq("user_id", p.user_id)
        .order("created_at", { ascending: false })
        .limit(25);
      setTxns((t ?? []) as Txn[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const adjust = async (sign: 1 | -1) => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Enter a reason", description: "A reason is required for the audit log.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_adjust_wallet", {
      p_profile_id: id!,
      p_amount: sign * value,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (error) {
      toast({ title: "Adjustment failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: sign > 0 ? "Wallet credited" : "Wallet debited",
      description: `New balance: ${naira(Number(data))}`,
    });
    setAmount("");
    setReason("");
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-3">
        <Button size="sm" variant="outline" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <p className="text-sm text-muted-foreground">User not found.</p>
      </div>
    );
  }

  const info: [string, string][] = [
    ["Full name", profile.full_name || "—"],
    ["Phone", profile.phone_number || "—"],
    ["Email", profile.contact_email || profile.email || "—"],
    ["Referral code", profile.referral_code || "—"],
    ["Referral earnings", naira(Number(profile.total_referral_earnings ?? 0))],
    ["Phone verified", profile.phone_verified ? "Yes" : "No"],
    ["Virtual account", profile.dva_account_number ? `${profile.dva_account_number} (${profile.dva_bank_name ?? ""})` : "—"],
    ["Registered", new Date(profile.created_at).toLocaleString()],
    ["User id", profile.user_id],
  ];

  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={() => navigate("/admin/users")}>
        <ArrowLeft className="mr-1 h-4 w-4" /> All users
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{profile.full_name || profile.phone_number || "User"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-border p-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Wallet balance</p>
              <p className="text-lg font-semibold">{naira(Number(profile.wallet_balance ?? 0))}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {info.map(([k, v]) => (
              <div key={k} className="rounded-md border border-border p-2 text-xs">
                <p className="text-muted-foreground">{k}</p>
                <p className="break-all font-medium">{v}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Adjust wallet balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Amount (₦)</Label>
              <Input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Refund for failed data purchase"
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => adjust(1)}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-1 h-4 w-4" />}
              Credit wallet
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => adjust(-1)}>
              <MinusCircle className="mr-1 h-4 w-4" /> Debit wallet
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Every adjustment creates a transaction, notifies the user and is recorded in the admin activity log.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {txns.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No transactions.</p>}
          {txns.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-md border border-border p-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.description || t.transaction_type}</p>
                <p className="text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
              </div>
              <Badge variant={t.status === "completed" ? "secondary" : "outline"}>{t.status}</Badge>
              <span className="font-medium">{naira(Number(t.amount))}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
