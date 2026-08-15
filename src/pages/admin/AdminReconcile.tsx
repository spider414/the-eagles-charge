import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import RecordDetailDialog from "@/components/admin/RecordDetailDialog";

const ngn = (n: number) =>
  "\u20a6" + Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Profile = { id: string; full_name: string | null; phone_number: string | null; email: string | null; contact_email: string | null };
type Row = {
  reference: string;
  created_at: string;
  local: { id: string; amount: number; status: string; type: string; balance_after: number | null } | null;
  remote: { amount: number; status: string; paid_at?: string; channel?: string } | null;
  ledger: { gross_amount: number; fee_amount: number; net_amount: number; method: string } | null;
  issues: string[];
};

const WINDOWS = [7, 30, 90, 365];

export default function AdminReconcile() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [onlyMismatch, setOnlyMismatch] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, phone_number, email, contact_email")
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => setProfiles((data ?? []) as Profile[]));
  }, []);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return profiles
      .filter((p) =>
        [p.full_name, p.phone_number, p.email, p.contact_email].some((v) => (v ?? "").toLowerCase().includes(term)),
      )
      .slice(0, 6);
  }, [profiles, q]);

  const run = async (profile: Profile, window: number) => {
    setSelected(profile);
    setDays(window);
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("admin-reconcile", {
      body: { profile_id: profile.id, days: window },
    });
    setLoading(false);
    if (err || data?.error) {
      setResult(null);
      setError(data?.error ?? err?.message ?? "Reconciliation failed");
      return;
    }
    setResult(data);
  };

  const rows: Row[] = (result?.rows ?? []).filter((r: Row) => !onlyMismatch || r.issues.length > 0);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Scale className="h-4 w-4" /> Paystack vs wallet reconciliation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search user by name, phone or email…"
            className="h-9"
          />
          {matches.length > 0 && (
            <div className="space-y-1">
              {matches.map((p) => (
                <button
                  key={p.id}
                  onClick={() => run(p, days)}
                  className="w-full rounded-md border border-border p-2 text-left text-xs hover:bg-muted/50"
                >
                  <span className="font-medium">{p.full_name || "Unnamed user"}</span>
                  <span className="ml-2 text-muted-foreground">
                    {p.phone_number} {p.contact_email || p.email}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selected.full_name || selected.phone_number} · last
              </span>
              {WINDOWS.map((w) => (
                <Button
                  key={w}
                  size="sm"
                  variant={days === w ? "default" : "outline"}
                  onClick={() => run(selected, w)}
                >
                  {w}d
                </Button>
              ))}
              <Button size="sm" variant={onlyMismatch ? "secondary" : "ghost"} onClick={() => setOnlyMismatch((v) => !v)}>
                Mismatches only
              </Button>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : result ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Records", value: String(result.totals.rows) },
                  { label: "Mismatches", value: String(result.totals.mismatches) },
                  { label: "Paystack success", value: ngn(result.totals.paystack_success_value) },
                  { label: "Credited to wallet", value: ngn(result.totals.wallet_credited_value) },
                ].map((s) => (
                  <div key={s.label} className="rounded-md border border-border p-2">
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                    <p className="text-sm font-semibold">{s.value}</p>
                  </div>
                ))}
              </div>

              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {onlyMismatch ? "No mismatches in this window." : "No payment records in this window."}
                </p>
              ) : (
                <div className="space-y-2">
                  {rows.map((r) => (
                    <button
                      key={r.reference}
                      onClick={() => setDetail(r)}
                      className={`w-full rounded-md border p-2.5 text-left text-xs hover:bg-muted/50 ${
                        r.issues.length ? "border-destructive/50" : "border-border"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {r.issues.length ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="font-medium">{ngn(r.remote?.amount ?? r.local?.amount ?? 0)}</span>
                        <Badge variant="outline">PS: {r.remote?.status ?? "missing"}</Badge>
                        <Badge variant="outline">App: {r.local?.status ?? "missing"}</Badge>
                        <span className="ml-auto text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-muted-foreground">ref {r.reference}</p>
                      {r.issues.map((i) => (
                        <p key={i} className="text-destructive">• {i}</p>
                      ))}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Search and pick a user to compare their Paystack payments against the wallet ledger.
            </p>
          )}
        </CardContent>
      </Card>

      <RecordDetailDialog
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
        title={`Reference ${detail?.reference ?? ""}`}
        description="Paystack record compared with the app's wallet ledger."
        raw={detail}
        fields={
          detail
            ? [
                { label: "Date", value: new Date(detail.created_at).toLocaleString() },
                { label: "Paystack status", value: detail.remote?.status ?? "not found" },
                { label: "Paystack amount", value: detail.remote ? ngn(detail.remote.amount) : "—" },
                { label: "Paystack channel", value: detail.remote?.channel },
                { label: "Paystack paid at", value: detail.remote?.paid_at },
                { label: "App status", value: detail.local?.status ?? "no local transaction" },
                { label: "App amount", value: detail.local ? ngn(detail.local.amount) : "—" },
                { label: "App transaction type", value: detail.local?.type },
                { label: "Balance after", value: detail.local?.balance_after != null ? ngn(detail.local.balance_after) : "—" },
                { label: "Ledger gross", value: detail.ledger ? ngn(detail.ledger.gross_amount) : "no ledger entry" },
                { label: "Ledger fee", value: detail.ledger ? ngn(detail.ledger.fee_amount) : "—" },
                { label: "Ledger credited", value: detail.ledger ? ngn(detail.ledger.net_amount) : "—" },
                { label: "Funding method", value: detail.ledger?.method },
                { label: "Issues", value: detail.issues.length ? detail.issues.join("\n") : "None" },
              ]
            : []
        }
      />
    </div>
  );
}
