import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token");
    let preferences: Record<string, boolean> | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = body.token ?? token;
      preferences = body.preferences ?? null;
    }

    if (!token || !/^[a-f0-9]{16,}$/i.test(token)) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, email_marketing_opt_in, email_promotions_opt_in, email_product_updates_opt_in")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (error || !profile) {
      return new Response(JSON.stringify({ error: "Token not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      return new Response(
        JSON.stringify({
          email_marketing_opt_in: profile.email_marketing_opt_in,
          email_promotions_opt_in: profile.email_promotions_opt_in,
          email_product_updates_opt_in: profile.email_product_updates_opt_in,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // POST: apply update. If no preferences, opt out of all non-essential.
    const update = preferences ?? {
      email_marketing_opt_in: false,
      email_promotions_opt_in: false,
      email_product_updates_opt_in: false,
    };
    const allowed = ["email_marketing_opt_in", "email_promotions_opt_in", "email_product_updates_opt_in"];
    const clean: Record<string, boolean> = {};
    for (const k of allowed) {
      if (typeof update[k] === "boolean") clean[k] = update[k];
    }

    const { error: uerr } = await admin.from("profiles").update(clean).eq("id", profile.id);
    if (uerr) throw uerr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("email-unsubscribe error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});