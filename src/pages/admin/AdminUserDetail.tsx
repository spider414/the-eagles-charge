import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Clock, Loader2, MinusCircle, PlusCircle, Send, ShieldOff, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const naira = (v: number) =>
  "\u20a6" + Number(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Adjustments at or above this value need an extra typed confirmation. */
const LARGE_ADJUSTMENT = 20000;

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
  contact_email_verified: boolean | null;
  suspended: boolean | null;
  suspended_reason: string | null;
  suspended_at: string | null;
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

type Activity = {
  last_sign_in_at: string | null;
  last_transaction_at: string | null;
};

const daysSince = (iso: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;

const WINBACK_DEFAULT =
  "We miss you! \uD83D\uDD25 Hot deals are live on HARMIC RECHARGE right now \u2014 cheap data, instant airtime, cable TV and electricity in seconds. Log in today and enjoy them before they end.";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSign, setPendingSign] = useState<1 | -1>(1);
  const [confirmText, setConfirmText] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendBusy, setSuspendBusy] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [winChannel, setWinChannel] = useState<"email" | "sms" | "both" | "push">("email");
  const [winSubject, setWinSubject] = useState("We miss you \u2014 hot deals are waiting \uD83D\uDD25");
  const [winMessage, setWinMessage] = useState(WINBACK_DEFAULT);
  const [winBusy, setWinBusy] = useState(false);

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
    const { data: act } = await supabase.functions.invoke("admin-outreach", {
      body: { action: "user_activity", profile_id: id },
    });
    if (act?.success) setActivity({ last_sign_in_at: act.last_sign_in_at, last_transaction_at: act.last_transaction_at });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const requestAdjust = (sign: 1 | -1) => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Enter a reason", description: "A reason is required for the audit log.", variant: "destructive" });
      return;
    }
    setPendingSign(sign);
    setConfirmText("");
    setConfirmOpen(true);
  };

  const adjust = async () => {
    const sign = pendingSign;
    const value = Number(amount);
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_adjust_wallet", {
      p_profile_id: id!,
      p_amount: sign * value,
      p_reason: reason.trim(),
    });
    setBusy(false);
    setConfirmOpen(false);
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

  const toggleSuspend = async (next: boolean) => {
    if (!id) return;
    if (next && !suspendReason.trim()) {
      toast({ title: "Enter a suspension reason", variant: "destructive" });
      return;
    }
    setSuspendBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        suspended: next,
        suspended_reason: next ? suspendReason.trim() : null,
        suspended_at: next ? new Date().toISOString() : null,
      })
      .eq("id", id);
    setSuspendBusy(false);
    if (error) {
      toast({ title: "Could not update account", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: next ? "Account suspended" : "Account restored",
      description: next ? "This user can no longer transact." : "This user can transact again.",
    });
    setSuspendReason("");
    load();
  };

  const sendWinback = async () => {
    if (!winMessage.trim()) {
      toast({ title: "Enter a message", variant: "destructive" });
      return;
    }
    setWinBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-outreach", {
      body: {
        action: "winback",
        profile_id: id,
        channel: winChannel,
        subject: winSubject.trim() || "We miss you",
        message: winMessage.trim(),
        push: true,
      },
    });
    setWinBusy(false);
    if (error || data?.error) {
      toast({ title: "Could not send", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Message sent",
      description: "In-app notification delivered" + (data?.sent ? " and message sent." : "."),
    });
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
    ["Email verified", profile.contact_email_verified ? "Yes" : "No"],
    ["Account status", profile.suspended ? `Suspended — ${profile.suspended_reason ?? "no reason"}` : "Active"],
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
            <Button size="sm" disabled={busy} onClick={() => requestAdjust(1)}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-1 h-4 w-4" />}
              Credit wallet
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => requestAdjust(-1)}>
              <MinusCircle className="mr-1 h-4 w-4" /> Debit wallet
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Every adjustment creates a transaction, notifies the user and is recorded in the admin activity log.
            Adjustments of {naira(LARGE_ADJUSTMENT)} or more need a typed confirmation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldOff className="h-4 w-4" /> Account access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">{profile.suspended ? "Suspended" : "Active"}</p>
              <p className="text-xs text-muted-foreground">
                Suspended users cannot recharge, subscribe or fund their wallet.
              </p>
            </div>
            <Switch
              checked={!!profile.suspended}
              disabled={suspendBusy}
              onCheckedChange={(v) => toggleSuspend(v)}
            />
          </div>
          {!profile.suspended && (
            <div className="space-y-1">
              <Label className="text-xs">Suspension reason (required to suspend)</Label>
              <Input
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Multiple accounts on one device"
                className="h-9"
              />
            </div>
          )}
          {profile.suspended && profile.suspended_at && (
            <p className="text-[11px] text-muted-foreground">
              Suspended on {new Date(profile.suspended_at).toLocaleString()}
            </p>
          )}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingSign > 0 ? "Credit" : "Debit"} {naira(Number(amount))}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {pendingSign > 0 ? "Credit" : "Debit"} {naira(Number(amount))}{" "}
              {pendingSign > 0 ? "to" : "from"} {profile.full_name || profile.phone_number || "this user"}. Reason: {reason}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {Number(amount) >= LARGE_ADJUSTMENT && (
            <div className="space-y-1">
              <Label className="text-xs">Type CONFIRM to approve this large adjustment</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="h-9" />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || (Number(amount) >= LARGE_ADJUSTMENT && confirmText.trim().toUpperCase() !== "CONFIRM")}
              onClick={(e) => {
                e.preventDefault();
                adjust();
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Yes, {pendingSign > 0 ? "credit" : "debit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
