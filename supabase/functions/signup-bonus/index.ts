import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK = { enabled: false, amount: 0, nin_verification_required: true };

// Public, read-only endpoint so web + Android clients can display the current
// signup bonus without hard-coding an amount.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin
      .from("app_settings")
      .select("registration_bonus_enabled, registration_bonus_amount, nin_verification_required")
      .limit(1)
      .maybeSingle();

    if (error || !data) return json(FALLBACK);

    const amount = Number(data.registration_bonus_amount) || 0;
    const enabled = data.registration_bonus_enabled === true && amount > 0;
    return json({
      enabled,
      amount: enabled ? amount : 0,
      currency: "NGN",
      nin_verification_required: data.nin_verification_required !== false,
    });
  } catch (e) {
    console.error("signup-bonus error", e);
    return json(FALLBACK);
  }
});
