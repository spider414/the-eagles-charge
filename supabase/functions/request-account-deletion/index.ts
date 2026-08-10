import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYNTHETIC = /@(eagles\.local|phone\.harmicglobal\.com)$/i;
const isRealEmail = (e?: string | null) =>
  !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !SYNTHETIC.test(e);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    let reason = "User requested deletion";
    try {
      const body = await req.json();
      if (typeof body?.reason === "string" && body.reason.trim()) {
        reason = body.reason.trim().slice(0, 300);
      }
    } catch (_) { /* no body */ }

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 7);

    const { data: profile, error: updErr } = await admin
      .from("profiles")
      .update({
        deletion_scheduled_at: scheduledFor.toISOString(),
        deletion_reason: reason,
      })
      .eq("user_id", user.id)
      .select("id, full_name, email, contact_email, phone_number")
      .maybeSingle();

    if (updErr) throw updErr;

    // Audit trail
    await admin.from("admin_activity_log").insert({
      actor_user_id: user.id,
      action: "account_deletion_requested",
      target_user_id: user.id,
      details: { scheduled_for: scheduledFor.toISOString(), reason },
    });

    const sendEmail = async (payload: Record<string, unknown>) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) console.error("send-email failed", res.status, await res.text());
      } catch (e) {
        console.error("send-email error", e);
      }
    };

    // 1. Notify admins
    const { data: settings } = await admin
      .from("email_settings")
      .select("support_email")
      .limit(1)
      .maybeSingle();

    const { data: adminRoles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = (adminRoles || []).map((r) => r.user_id);
    let adminEmails: string[] = [];
    if (adminIds.length) {
      const { data: adminProfiles } = await admin
        .from("profiles")
        .select("email, contact_email")
        .in("user_id", adminIds);
      adminEmails = (adminProfiles || [])
        .flatMap((p) => [p.contact_email, p.email])
        .filter((e): e is string => isRealEmail(e));
    }
    if (isRealEmail(settings?.support_email)) adminEmails.push(settings!.support_email as string);
    adminEmails = [...new Set(adminEmails.map((e) => e.toLowerCase()))];

    const userEmail = isRealEmail(profile?.contact_email)
      ? profile!.contact_email!
      : isRealEmail(profile?.email)
        ? profile!.email!
        : null;

    for (const to of adminEmails) {
      await sendEmail({
        type: "account_deletion_request",
        to,
        name: profile?.full_name ?? null,
        user_email: userEmail ?? profile?.email ?? null,
        phone_number: profile?.phone_number ?? null,
        user_id: user.id,
        scheduled_for: scheduledFor.toISOString(),
        reason,
      });
    }

    // 2. Confirm to the user
    if (userEmail) {
      await sendEmail({
        type: "account_deletion_confirmed",
        to: userEmail,
        name: profile?.full_name ?? null,
        scheduled_for: scheduledFor.toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ success: true, scheduled_for: scheduledFor.toISOString(), admins_notified: adminEmails.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("request-account-deletion error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to schedule deletion" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
