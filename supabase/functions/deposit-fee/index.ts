import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DEFAULT_DEPOSIT_FEE, computeDepositFee, computeNetDeposit, getDepositFeeConfig } from "../_shared/depositFee.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Public, read-only endpoint so web + Android clients can render the deposit
// (funding) fee breakdown without hard-coding a percentage.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    });

  const sample = (cfg: { enabled: boolean; percent: number }, amount: number) => ({
    amount,
    fee: computeDepositFee(amount, cfg),
    credited: computeNetDeposit(amount, cfg),
  });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const cfg = await getDepositFeeConfig(admin);
    const enabled = cfg.enabled && cfg.percent > 0;

    let amount = 0;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      amount = Number(body?.amount) || 0;
    } else {
      amount = Number(new URL(req.url).searchParams.get("amount")) || 0;
    }

    return json({
      enabled,
      percent: enabled ? cfg.percent : 0,
      currency: "NGN",
      rounding: "ceil",
      example: sample({ enabled, percent: cfg.percent }, 10000),
      ...(amount > 0 ? { quote: sample({ enabled, percent: cfg.percent }, amount) } : {}),
    });
  } catch (e) {
    console.error("deposit-fee error", e);
    return json({ enabled: DEFAULT_DEPOSIT_FEE.enabled, percent: DEFAULT_DEPOSIT_FEE.percent, currency: "NGN" });
  }
});
