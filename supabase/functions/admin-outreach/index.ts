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
  const email = isRealEmail(r.contact_email) ? r.contact_email : isRealEmail(r.email) ? r.email : null;
  if ((opts.channel === "email" || opts.channel === "both") && email) {
    const { error } = await admin.functions.invoke("send-email", {
      body: {
        type: opts.promo ? "admin_promo" : "admin_message",
        to: email,
        name: r.full_name,
        subject: opts.subject,
        heading: opts.subject,
        message: opts.message,
      },
    });
    if (!error) sent = true;
  }
  if (opts.channel === "sms" || opts.channel === "both") {
    const phone = toE164(r.phone_number);
    if (phone) {
      try {
        await sendSms(phone, `${opts.subject}\n\n${opts.message}`.slice(0, 900));
        sent = true;
      } catch (e) {
        console.error("sms failed", r.id, e);
      }
    }
  }
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
