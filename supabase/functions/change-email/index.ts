import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODE_TTL_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
  !/@(eagles\.local|phone\.harmicglobal\.com)$/.test(email) &&
  email.length <= 255;

const genCode = () => String(Math.floor(100000 + Math.random() * 900000));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Invalid token" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, email, contact_email, contact_email_verified")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) return json({ error: "Profile not found" }, 404);

    // ---------------------------------------------------------------- status
    if (action === "status") {
      const { data: pending } = await admin
        .from("email_change_requests")
        .select("new_email, expires_at, created_at")
        .eq("user_id", user.id)
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return json({
        email: profile.contact_email || null,
        verified: !!profile.contact_email_verified,
        pending: pending
          ? { new_email: pending.new_email, expires_at: pending.expires_at }
          : null,
      });
    }

    // ------------------------------------------------------------------ send
    if (action === "send" || action === "resend") {
      let target = String(body?.new_email || "").trim().toLowerCase();

      if (action === "resend" && !target) {
        const { data: pending } = await admin
          .from("email_change_requests")
          .select("new_email")
          .eq("user_id", user.id)
          .eq("verified", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        target = pending?.new_email || String(profile.contact_email || "").toLowerCase();
      }

      if (!isValidEmail(target)) return json({ error: "Please enter a valid email address" }, 400);

      // Email must not already belong to another account
      const { data: taken } = await admin
        .from("profiles")
        .select("id")
        .or(`contact_email.eq.${target},email.eq.${target}`)
        .neq("id", profile.id)
        .limit(1)
        .maybeSingle();
      if (taken) return json({ error: "That email is already used by another account" }, 409);

      // Cooldown between sends
      const { data: last } = await admin
        .from("email_change_requests")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last?.created_at) {
        const elapsed = (Date.now() - new Date(last.created_at).getTime()) / 1000;
        if (elapsed < RESEND_COOLDOWN_SECONDS) {
          return json(
            { error: `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)}s before requesting another code` },
            429,
          );
        }
      }

      const code = genCode();
      const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

      // Invalidate previous pending requests
      await admin
        .from("email_change_requests")
        .delete()
        .eq("user_id", user.id)
        .eq("verified", false);

      const { error: insertError } = await admin.from("email_change_requests").insert({
        user_id: user.id,
        new_email: target,
        code,
        expires_at: expiresAt,
      });
      if (insertError) throw insertError;

      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          type: "email_verification",
          to: target,
          name: profile.full_name,
          code,
          expires_minutes: CODE_TTL_MINUTES,
        }),
      });
      if (!emailRes.ok) {
        console.error("send-email failed", emailRes.status, await emailRes.text());
        return json({ error: "Could not send the verification email. Please try again." }, 502);
      }

      return json({ success: true, new_email: target, expires_at: expiresAt });
    }

    // ---------------------------------------------------------------- verify
    if (action === "verify") {
      const code = String(body?.code || "").trim();
      if (!/^\d{6}$/.test(code)) return json({ error: "Enter the 6-digit code" }, 400);

      const { data: request } = await admin
        .from("email_change_requests")
        .select("*")
        .eq("user_id", user.id)
        .eq("verified", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!request) return json({ error: "No pending verification. Request a new code." }, 404);
      if (new Date(request.expires_at).getTime() < Date.now())
        return json({ error: "That code has expired. Request a new one." }, 410);
      if (request.attempts >= MAX_ATTEMPTS)
        return json({ error: "Too many wrong attempts. Request a new code." }, 429);

      if (request.code !== code) {
        await admin
          .from("email_change_requests")
          .update({ attempts: request.attempts + 1 })
          .eq("id", request.id);
        return json({ error: "Incorrect code. Please try again." }, 400);
      }

      await admin
        .from("email_change_requests")
        .update({ verified: true })
        .eq("id", request.id);

      const { error: updateError } = await admin
        .from("profiles")
        .update({ contact_email: request.new_email, contact_email_verified: true })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      // Keep the auth email in sync for accounts that sign in with a real email
      if (user.email && !/@(eagles\.local|phone\.harmicglobal\.com)$/.test(user.email)) {
        const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
          email: request.new_email,
          email_confirm: true,
        });
        if (authError) console.error("auth email sync failed", authError);
      }

      await admin.from("admin_activity_log").insert({
        actor_user_id: user.id,
        target_user_id: user.id,
        action: "email_changed",
        details: { new_email: request.new_email },
      });

      return json({ success: true, email: request.new_email });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("change-email error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});