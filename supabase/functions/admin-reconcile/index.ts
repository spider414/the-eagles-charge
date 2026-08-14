import { requireAdmin, serviceClient } from "../_shared/admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PAYSTACK_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

async function paystack(path: string) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_KEY}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`paystack ${path} failed [${res.status}]`, JSON.stringify(body));
  }
  return { ok: res.ok, status: res.status, body } as { ok: boolean; status: number; body: any };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = await requireAdmin(req, corsHeaders);
  if ("error" in gate) return gate.error;

  try {
    const body = await req.json().catch(() => ({}));
    const profileId: string | undefined = body?.profile_id;
    const days = Math.min(Math.max(Number(body?.days) || 30, 1), 365);
    if (!profileId) return json({ error: "profile_id is required" }, 400);

    const admin = serviceClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, user_id, email, contact_email, full_name, wallet_balance")
      .eq("id", profileId)
      .maybeSingle();
    if (!profile) return json({ error: "User not found" }, 404);

    const from = new Date(Date.now() - days * 86400000).toISOString();

    const { data: localTx } = await admin
      .from("transactions")
      .select("id, amount, status, transaction_type, paystack_reference, description, created_at, balance_before, balance_after")
      .eq("user_id", profile.user_id)
      .gte("created_at", from)
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: feeLogs } = await admin
      .from("deposit_fee_log")
      .select("reference, gross_amount, fee_amount, net_amount, method, created_at")
      .eq("user_id", profile.user_id)
      .gte("created_at", from)
      .limit(500);

    const emails = [profile.email, profile.contact_email].filter(Boolean).map((e: string) => e.toLowerCase());

    // Pull the Paystack side of the window (a few pages is enough for one user).
    const remote: any[] = [];
    if (PAYSTACK_KEY) {
      for (let page = 1; page <= 3; page++) {
        const r = await paystack(
          `/transaction?perPage=100&page=${page}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(new Date().toISOString())}`,
        );
        if (!r.ok || !Array.isArray(r.body?.data)) break;
        remote.push(...r.body.data);
        if (r.body.data.length < 100) break;
      }
    }

    const mine = remote.filter((t) => {
      const email = (t?.customer?.email ?? "").toLowerCase();
      const ref = String(t?.reference ?? "");
      return emails.includes(email) || (localTx ?? []).some((l) => l.paystack_reference === ref);
    });

    const byRef = new Map<string, any>(mine.map((t) => [String(t.reference), t]));
    const rows: any[] = [];

    for (const l of localTx ?? []) {
      if (!l.paystack_reference) continue;
      let r = byRef.get(l.paystack_reference);
      if (!r && PAYSTACK_KEY) {
        const v = await paystack(`/transaction/verify/${encodeURIComponent(l.paystack_reference)}`);
        if (v.ok && v.body?.data) r = v.body.data;
      }
      const remoteAmount = r ? Number(r.amount) / 100 : null;
      const remoteStatus = r ? String(r.status) : null;
      const fee = (feeLogs ?? []).find((f) => f.reference === l.paystack_reference) ?? null;

      const issues: string[] = [];
      if (!r) issues.push("Not found on Paystack");
      else {
        if (remoteStatus === "success" && l.status !== "completed") issues.push("Paid on Paystack but not completed locally");
        if (remoteStatus !== "success" && l.status === "completed") issues.push("Completed locally but not successful on Paystack");
        if (remoteAmount !== null && Math.abs(remoteAmount - Number(l.amount)) > 0.5) issues.push("Amount mismatch");
        if (remoteStatus === "success" && l.transaction_type === "wallet_topup" && !fee) {
          issues.push("No ledger (fee log) entry for this deposit");
        }
      }
      byRef.delete(l.paystack_reference);

      rows.push({
        reference: l.paystack_reference,
        created_at: l.created_at,
        local: { id: l.id, amount: Number(l.amount), status: l.status, type: l.transaction_type, balance_after: l.balance_after },
        remote: r ? { amount: remoteAmount, status: remoteStatus, paid_at: r.paid_at, channel: r.channel } : null,
        ledger: fee,
        issues,
      });
    }

    // Paystack charges with no local transaction at all.
    for (const [ref, r] of byRef) {
      rows.push({
        reference: ref,
        created_at: r.paid_at ?? r.created_at,
        local: null,
        remote: { amount: Number(r.amount) / 100, status: String(r.status), paid_at: r.paid_at, channel: r.channel },
        ledger: (feeLogs ?? []).find((f) => f.reference === ref) ?? null,
        issues: String(r.status) === "success" ? ["Paid on Paystack, missing from wallet ledger"] : [],
      });
    }

    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return json({
      user: {
        profile_id: profile.id,
        user_id: profile.user_id,
        name: profile.full_name,
        email: profile.contact_email ?? profile.email,
        wallet_balance: Number(profile.wallet_balance ?? 0),
      },
      window: { from, days },
      paystack_available: !!PAYSTACK_KEY,
      totals: {
        rows: rows.length,
        mismatches: rows.filter((r) => r.issues.length > 0).length,
        paystack_success_value: rows
          .filter((r) => r.remote?.status === "success")
          .reduce((s, r) => s + Number(r.remote.amount || 0), 0),
        wallet_credited_value: rows
          .filter((r) => r.local?.type === "wallet_topup" && r.local?.status === "completed")
          .reduce((s, r) => s + Number(r.ledger?.net_amount ?? r.local.amount ?? 0), 0),
      },
      rows,
    });
  } catch (e) {
    console.error("admin-reconcile error", e);
    return json({ error: e instanceof Error ? e.message : "Reconciliation failed" }, 500);
  }
});
