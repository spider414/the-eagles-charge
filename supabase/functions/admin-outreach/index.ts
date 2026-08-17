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

const toE164 = (raw: string | null | undefined) => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("234")) return `+${digits}`;
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (digits.length === 10) return `+234${digits}`;
  return `+${digits}`;
};

const isRealEmail = (e: string | null | undefined) =>
  !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !/@(eagles\.local|phone\.harmicglobal\.com)$/.test(e);

/**
 * Calls the send-email function directly over HTTP with the service role key.
 * supabase-js `functions.invoke` swallows non-2xx bodies and was failing silently,
 * so admin emails never reached Resend.
 */
async function sendEmail(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { ok: false, error: "Email service not configured" };
  try {
    const res = await fetch(`${url}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("send-email failed", res.status, text);
      return { ok: false, error: text || `HTTP ${res.status}` };
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // non-JSON success body
    }
    if (parsed.skipped) return { ok: false, error: `skipped: ${parsed.skipped}` };
    return { ok: true };
  } catch (e) {
    console.error("send-email network error", e);
    return { ok: false, error: e instanceof Error ? e.message : "Email request failed" };
  }
}

async function sendSms(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!sid || !token || !from) throw new Error("SMS service not configured");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out?.message || "SMS delivery failed");
}

/** Fires a web push for a notification row that was already inserted. */
async function pushOnly(userId: string, title: string, body: string, type = "general") {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  try {
    await fetch(`${url}/functions/v1/send-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "push", user_id: userId, title, body, type }),
    });
  } catch (e) {
    console.error("push failed", userId, e);
  }
}

type Recipient = {
  id: string;
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  contact_email: string | null;
  email: string | null;
};

async function deliver(
  admin: ReturnType<typeof serviceClient>,
  r: Recipient,
  opts: { channel: string; subject: string; message: string; promo: boolean },
) {
  let sent = false;
  let lastError: string | undefined;
  const email = isRealEmail(r.contact_email) ? r.contact_email : isRealEmail(r.email) ? r.email : null;
  if ((opts.channel === "email" || opts.channel === "both") && email) {
    const res = await sendEmail({
      type: opts.promo ? "admin_promo" : "admin_message",
      to: email,
      name: r.full_name,
      subject: opts.subject,
      heading: opts.subject,
      message: opts.message,
    });
    if (res.ok) sent = true;
    else lastError = res.error;
  } else if ((opts.channel === "email" || opts.channel === "both") && !email) {
    lastError = "no_valid_email_address";
  }
  if (opts.channel === "sms" || opts.channel === "both") {
    const phone = toE164(r.phone_number);
    if (phone) {
      try {
        await sendSms(phone, `${opts.subject}\n\n${opts.message}`.slice(0, 900));
        sent = true;
      } catch (e) {
        console.error("sms failed", r.id, e);
        lastError = e instanceof Error ? e.message : "SMS failed";
      }
    } else {
      lastError = lastError ?? "no_valid_phone_number";
    }
  }
  if (!sent && lastError) console.error("deliver failed", r.id, lastError);
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const gate = await requireAdmin(req, corsHeaders);
  if ("error" in gate) return gate.error;

  try {
    const admin = serviceClient();
    const body = await req.json();
    const action = String(body?.action ?? "");

    if (action === "user_activity") {
      const { profile_id } = body ?? {};
      if (!profile_id) return json({ error: "profile_id is required" }, 400);
      const { data: profile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("id", profile_id)
        .maybeSingle();
      if (!profile) return json({ error: "User not found" }, 404);
      const { data: authUser, error } = await admin.auth.admin.getUserById(profile.user_id);
      if (error) return json({ error: error.message }, 400);
      const { data: lastTxn } = await admin
        .from("transactions")
        .select("created_at")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: gate } = await admin.rpc("can_transact", { _user_id: profile.user_id });
      const gateRow = Array.isArray(gate) ? gate[0] : gate;
      const { data: lastReminder } = await admin
        .from("recovery_actions")
        .select("created_at")
        .eq("user_id", profile.user_id)
        .eq("action", "verify_email_reminder")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return json({
        success: true,
        last_sign_in_at: authUser?.user?.last_sign_in_at ?? null,
        created_at: authUser?.user?.created_at ?? null,
        last_transaction_at: lastTxn?.created_at ?? null,
        gate_allowed: gateRow?.allowed ?? null,
        gate_reason: gateRow?.reason ?? null,
        last_verify_reminder_at: lastReminder?.created_at ?? null,
      });
    }

    if (action === "winback") {
      const {
        profile_id,
        channel = "email",
        subject = "We miss you \u2014 hot deals are waiting",
        message = "",
        push = true,
      } = body ?? {};
      if (!profile_id || !String(message).trim())
        return json({ error: "profile_id and message are required" }, 400);

      const { data: profile } = await admin
        .from("profiles")
        .select("id, user_id, full_name, phone_number, contact_email, email")
        .eq("id", profile_id)
        .maybeSingle();
      if (!profile) return json({ error: "User not found" }, 404);

      const sent =
        channel === "push"
          ? false
          : await deliver(admin, profile as Recipient, { channel, subject, message, promo: true });

      if (push || channel === "push") {
        await admin.from("notifications").insert({
          user_id: profile.user_id,
          title: subject,
          body: message,
          type: "promo",
        });
        await pushOnly(profile.user_id, subject, message, "promo");
      }

      await admin.from("recovery_actions").insert({
        user_id: profile.user_id,
        actor_user_id: gate.userId,
        action: "winback",
        channel,
        message,
      });

      return json({ success: true, sent });
    }

    if (action === "verify_reminder") {
      const {
        profile_id = null,
        channel = "push",
        title = "Verify your email to continue",
        message =
          "Your email address is not verified yet, so recharges and subscriptions are blocked. Open Settings > Email and verify your email to start transacting again.",
      } = body ?? {};

      const COOLDOWN_MINUTES = 60;
      if (profile_id) {
        const { data: target } = await admin
          .from("profiles")
          .select("user_id")
          .eq("id", profile_id)
          .maybeSingle();
        if (target?.user_id) {
          const since = new Date(Date.now() - COOLDOWN_MINUTES * 60000).toISOString();
          const { data: recent } = await admin
            .from("recovery_actions")
            .select("created_at")
            .eq("user_id", target.user_id)
            .eq("action", "verify_email_reminder")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (recent?.created_at) {
            const mins = Math.max(
              1,
              COOLDOWN_MINUTES - Math.floor((Date.now() - new Date(recent.created_at).getTime()) / 60000),
            );
            return json(
              { error: `A reminder was already sent recently. Please wait ${mins} more minute(s).` },
              429,
            );
          }
        }
      }

      let query = admin
        .from("profiles")
        .select("id, user_id, full_name, phone_number, contact_email, email")
        .eq("contact_email_verified", false);
      if (profile_id) query = query.eq("id", profile_id);
      const { data: list, error } = await query.limit(2000);
      if (error) return json({ error: error.message }, 400);

      const recipients = (list ?? []) as Recipient[];
      if (recipients.length === 0) {
        return json({ error: "No unverified users to remind" }, 400);
      }

      let notified = 0;
      let messaged = 0;
      for (const r of recipients) {
        const { error: insertError } = await admin.from("notifications").insert({
          user_id: r.user_id,
          title,
          body: message,
          type: "account",
        });
        if (!insertError) notified++;
        await pushOnly(r.user_id, title, message, "account");
        if (channel !== "push") {
          const sent = await deliver(admin, r, { channel, subject: title, message, promo: false });
          if (sent) messaged++;
        }
        await admin.from("recovery_actions").insert({
          user_id: r.user_id,
          actor_user_id: gate.userId,
          action: "verify_email_reminder",
          channel,
          message,
        });
      }

      return json({ success: true, recipients: recipients.length, notified, messaged });
    }

    if (action === "recovery") {
      const {
        profile_id,
        transaction_id = null,
        channel = "email",
        subject = "About your recent transaction",
        message = "",
        refund_amount = 0,
        reason = "Failed transaction recovery",
      } = body ?? {};
      if (!profile_id || !String(message).trim()) return json({ error: "profile_id and message are required" }, 400);

      const { data: profile } = await admin
        .from("profiles")
        .select("id, user_id, full_name, phone_number, contact_email, email")
        .eq("id", profile_id)
        .maybeSingle();
      if (!profile) return json({ error: "User not found" }, 404);

      let refunded = 0;
      if (Number(refund_amount) > 0) {
        const { error } = await admin.rpc("credit_wallet", {
          p_profile_id: profile.id,
          p_amount: Number(refund_amount),
        });
        if (error) return json({ error: error.message }, 400);
        refunded = Number(refund_amount);
        await admin.from("transactions").insert({
          user_id: profile.user_id,
          transaction_type: "wallet_topup",
          status: "completed",
          amount: refunded,
          description: `Refund: ${reason}`,
        });
        await admin.from("notifications").insert({
          user_id: profile.user_id,
          title: "Refund credited",
          body: `We have refunded ₦${refunded.toLocaleString()} to your wallet. ${reason}`,
          type: "wallet",
        });
      }

      const sent = await deliver(admin, profile as Recipient, {
        channel,
        subject,
        message,
        promo: false,
      });

      await admin.from("recovery_actions").insert({
        transaction_id,
        user_id: profile.user_id,
        actor_user_id: gate.userId,
        action: refunded > 0 ? "refund_and_notify" : "notify",
        channel,
        message,
        amount: refunded || null,
      });

      return json({ success: true, sent, refunded });
    }

    if (action === "suspend") {
      const { profile_id, suspended, reason = "", notify = true } = body ?? {};
      if (!profile_id || typeof suspended !== "boolean")
        return json({ error: "profile_id and suspended are required" }, 400);
      if (suspended && !String(reason).trim())
        return json({ error: "A suspension reason is required" }, 400);

      const { data: profile } = await admin
        .from("profiles")
        .select("id, user_id, full_name, phone_number, contact_email, email")
        .eq("id", profile_id)
        .maybeSingle();
      if (!profile) return json({ error: "User not found" }, 404);

      const { error: updateError } = await admin
        .from("profiles")
        .update({
          suspended,
          suspended_reason: suspended ? String(reason).trim() : null,
          suspended_at: suspended ? new Date().toISOString() : null,
        })
        .eq("id", profile_id);
      if (updateError) return json({ error: updateError.message }, 400);

      const title = suspended ? "Your account has been suspended" : "Your account has been restored";
      const message = suspended
        ? `Your HARMIC RECHARGE account has been suspended. Reason: ${String(reason).trim()}. You cannot recharge, subscribe or fund your wallet until this is resolved. Contact support if you believe this is a mistake.`
        : "Your HARMIC RECHARGE account has been restored. You can now recharge, subscribe and fund your wallet again.";

      let emailed = false;
      if (notify) {
        await admin.from("notifications").insert({
          user_id: profile.user_id,
          title,
          body: message,
          type: "account",
        });
        await pushOnly(profile.user_id, title, message, "account");
        emailed = await deliver(admin, profile as Recipient, {
          channel: "email",
          subject: title,
          message,
          promo: false,
        });
      }

      await admin.from("recovery_actions").insert({
        user_id: profile.user_id,
        actor_user_id: gate.userId,
        action: suspended ? "account_suspended" : "account_restored",
        channel: "app",
        message,
      });

      return json({ success: true, suspended, notified: notify, emailed });
    }

    if (action === "campaign") {
      const {
        channel = "email",
        segment = "all",
        target_user_ids = [],
        template_key = null,
        subject = "",
        message = "",
      } = body ?? {};
      if (!String(message).trim() || !String(subject).trim())
        return json({ error: "subject and message are required" }, 400);

      let query = admin.from("profiles").select("id, user_id, full_name, phone_number, contact_email, email");
      if (segment === "selected") {
        if (!Array.isArray(target_user_ids) || target_user_ids.length === 0)
          return json({ error: "Select at least one user" }, 400);
        query = query.in("id", target_user_ids);
      } else if (segment === "verified") {
        query = query.eq("contact_email_verified", true);
      } else if (segment === "unverified") {
        query = query.eq("contact_email_verified", false);
      }
      query = query.eq("suspended", false).limit(2000);
      const { data: recipients, error } = await query;
      if (error) return json({ error: error.message }, 400);

      const list = (recipients ?? []) as Recipient[];
      const { data: campaign } = await admin
        .from("admin_campaigns")
        .insert({
          created_by: gate.userId,
          channel,
          segment,
          target_user_ids: segment === "selected" ? target_user_ids : null,
          template_key,
          subject,
          body: message,
          recipient_count: list.length,
          status: "sending",
        })
        .select("id")
        .maybeSingle();

      let ok = 0;
      let failed = 0;
      for (const r of list) {
        const delivered = await deliver(admin, r, { channel, subject, message, promo: true });
        delivered ? ok++ : failed++;
      }

      if (campaign?.id) {
        await admin
          .from("admin_campaigns")
          .update({ sent_count: ok, failed_count: failed, status: "sent" })
          .eq("id", campaign.id);
      }

      return json({ success: true, recipients: list.length, sent: ok, failed });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-outreach error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
