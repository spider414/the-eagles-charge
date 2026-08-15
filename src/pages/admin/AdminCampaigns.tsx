import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Megaphone, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Row = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  contact_email: string | null;
};

type Campaign = {
  id: string;
  channel: string;
  segment: string;
  subject: string | null;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
};

const TEMPLATES = [
  {
    key: "data_promo",
    label: "Cheap data promo",
    subject: "📶 Cheaper data all week on HARMIC RECHARGE",
    body: "Enjoy our lowest data prices this week across MTN, Glo, Airtel and 9mobile.\n\nTop up your wallet and buy in seconds — no queues, instant delivery.",
  },
  {
    key: "referral",
    label: "Referral push",
    subject: "🎁 Earn ₦1,000 for every friend you invite",
    body: "Share your referral code with friends. When they fund their wallet, we credit you ₦1,000 instantly.\n\nOpen the app, tap Referrals and copy your code.",
  },
  {
    key: "welcome_bonus",
    label: "Welcome bonus reminder",
    subject: "🎉 Your welcome bonus is waiting",
    body: "New here? Your welcome bonus lands in your wallet the moment you sign up.\n\nUse it on airtime, data, electricity, cable TV and more.",
  },
  {
    key: "bills",
    label: "Bills & TV reminder",
    subject: "💡 Pay light bill & renew DSTV in one place",
    body: "Never miss a due date again. Recharge your meter and renew DSTV, GOtv or StarTimes right inside the app — instant tokens and instant activation.",
  },
  {
    key: "reactivation",
    label: "We miss you",
    subject: "👋 We miss you at HARMIC RECHARGE",
    body: "It's been a while! Your account is still active and your wallet is ready.\n\nCome back for fast airtime, cheap data and instant bill payments.",
  },
];

export default function AdminCampaigns() {
  const { toast } = useToast();
  const [users, setUsers] = useState<Row[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [channel, setChannel] = useState("email");
  const [segment, setSegment] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [body, setBody] = useState(TEMPLATES[0].body);
  const [templateKey, setTemplateKey] = useState(TEMPLATES[0].key);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSms, setConfirmSms] = useState(false);

  const load = async () => {
    const [{ data: u }, { data: c }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone_number, contact_email").order("created_at", { ascending: false }).limit(1000),
      supabase.from("admin_campaigns").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setUsers((u ?? []) as Row[]);
    setCampaigns((c ?? []) as Campaign[]);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users.slice(0, 50);
    return users
      .filter((u) => [u.full_name, u.phone_number, u.contact_email].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)))
      .slice(0, 50);
  }, [users, q]);

  const applyTemplate = (key: string) => {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setTemplateKey(key);
    setSubject(t.subject);
    setBody(t.body);
  };

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Subject and message are required", variant: "destructive" });
      return;
    }
    if (segment === "selected" && selected.length === 0) {
      toast({ title: "Select at least one user", variant: "destructive" });
      return;
    }
    if ((channel === "sms" || channel === "both") && !confirmSms) {
      toast({
        title: "Confirm SMS sending",
        description: "SMS costs money per message. Tick the confirmation box first.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-outreach", {
      body: {
        action: "campaign",
        channel,
        segment,
        target_user_ids: selected,
        template_key: templateKey,
        subject,
        message: body,
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast({ title: "Campaign failed", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Campaign sent", description: `${(data as any).sent} delivered, ${(data as any).failed} failed.` });
    setConfirmSms(false);
    load();
  };

  const recipientEstimate = segment === "selected" ? selected.length : users.length;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Megaphone className="h-4 w-4" /> Promo campaigns
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Template</Label>
              <Select value={templateKey} onValueChange={applyTemplate}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <Label className="text-xs">Audience</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="verified">Verified email only</SelectItem>
                  <SelectItem value="unverified">Unverified email only</SelectItem>
                  <SelectItem value="selected">Selected users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {segment === "selected" && (
            <div className="space-y-2 rounded-md border border-border p-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users" className="h-9 pl-8" />
              </div>
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {filteredUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded p-1.5 text-xs hover:bg-muted/50">
                    <Checkbox
                      checked={selected.includes(u.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => (v ? [...prev, u.id] : prev.filter((x) => x !== u.id)))
                      }
                    />
                    <span className="truncate">
                      {u.full_name || "Unnamed"} · {u.phone_number || u.contact_email || "—"}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{selected.length} selected</p>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Message</Label>
            <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          {(channel === "sms" || channel === "both") && (
            <label className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
              <Checkbox checked={confirmSms} onCheckedChange={(v) => setConfirmSms(!!v)} />
              <span>
                I understand SMS is charged per message and this will send to about <strong>{recipientEstimate}</strong> users.
              </span>
            </label>
          )}

          <Button onClick={send} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send campaign
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Promo emails respect each user's promotions opt-in. Suspended accounts are skipped.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent campaigns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {campaigns.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No campaigns yet.</p>}
          {campaigns.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.subject}</p>
                <p className="text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()} · {c.channel} · {c.segment}
                </p>
              </div>
              <Badge variant="secondary">{c.status}</Badge>
              <span>
                {c.sent_count}/{c.recipient_count} sent{c.failed_count ? ` · ${c.failed_count} failed` : ""}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
