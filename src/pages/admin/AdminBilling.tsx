import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import RecordDetailDialog from "@/components/admin/RecordDetailDialog";

type Tx = {
  id: string;
  user_id: string;
  transaction_type: string;
  status: string;
  amount: number;
  description: string | null;
  paystack_reference: string | null;
  created_at: string;
};

const STATUSES = ["all", "completed", "pending", "processing", "failed", "refunded"] as const;
const TABS = [
  { key: "paystack", label: "Paystack payments" },
  { key: "credits", label: "Credit purchases" },
  { key: "subscriptions", label: "Active subscriptions" },
] as const;

const ngn = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(n);

export default function AdminBilling() {
  const [tx, setTx] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("paystack");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Tx | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("id, user_id, transaction_type, status, amount, description, paystack_reference, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    setTx((data ?? []) as Tx[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tx
      .filter((t) => {
        if (tab === "paystack") return !!t.paystack_reference;
        if (tab === "credits") return t.transaction_type === "wallet_topup";
        return false; // subscriptions: none recorded yet
      })
      .filter((t) => status === "all" || t.status === status)
      .filter(
        (t) =>
          !term ||
          [t.paystack_reference, t.description, t.user_id, t.id, String(t.amount)].some((v) =>
            (v ?? "").toLowerCase().includes(term),
          ),
      );
  }, [tx, tab, status, q]);

  const total = rows.reduce((s, t) => s + Number(t.amount || 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Records</p>
            <p className="text-lg font-semibold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Total value</p>
            <p className="text-lg font-semibold">{ngn(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground">Completed</p>
            <p className="text-lg font-semibold">
              {rows.filter((r) => r.status === "completed").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-sm">Billing</CardTitle>
          <Button variant="ghost" size="icon" onClick={load} aria-label="Refresh billing data">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant={tab === t.key ? "default" : "outline"}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === s ? "secondary" : "ghost"}
                className="capitalize"
                onClick={() => setStatus(s)}
              >
                {s}
              </Button>
            ))}
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reference, user id, amount…"
              className="h-8 w-full sm:w-64"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tab === "subscriptions" ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No subscription products are configured yet, so there are no active subscriptions to show.
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No matching records.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDetail(t)}
                  className="w-full rounded-md border border-border p-2.5 text-left text-xs hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{ngn(Number(t.amount))}</span>
                    <Badge variant={t.status === "completed" ? "secondary" : "outline"} className="capitalize">
                      {t.status}
                    </Badge>
                    <span className="ml-auto text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-muted-foreground">
                    {t.description || t.transaction_type}
                    {t.paystack_reference ? ` · ref ${t.paystack_reference}` : ""}
                  </p>
                  <p className="break-all text-muted-foreground">user: {t.user_id}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RecordDetailDialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={detail ? `${ngn(Number(detail.amount))} · ${detail.status}` : ""}
        description={detail ? new Date(detail.created_at).toLocaleString() : undefined}
        raw={detail}
        fields={
          detail
            ? [
                { label: "Amount", value: ngn(Number(detail.amount)) },
                { label: "Status", value: detail.status },
                { label: "Type", value: detail.transaction_type },
                { label: "Description", value: detail.description },
                { label: "Paystack reference", value: detail.paystack_reference },
                { label: "User id", value: detail.user_id },
                { label: "Transaction id", value: detail.id },
                { label: "Created", value: new Date(detail.created_at).toLocaleString() },
              ]
            : []
        }
      />
    </div>
  );
}
