import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const DEFAULT_FROM = "HARMIC RECHARGE <noreply@harmicglobal.com>";
const DEFAULT_SUPPORT = "support@harmicglobal.com";
const DEFAULT_PRIMARY = "#16a34a";
const DEFAULT_DARK = "#0f172a";
const DEFAULT_BRAND = "HARMIC RECHARGE";
const DEFAULT_EMOJI = "🦅";

interface Branding {
  brand_name: string;
  logo_url: string | null;
  logo_emoji: string;
  primary_color: string;
  dark_color: string;
  header_tagline: string;
  footer_text: string;
  support_email: string;
  from_address: string;
}

interface TemplateCopy {
  subject: string;
  intro: string;
  outro: string;
  enabled: boolean;
}

// Non-essential email types respect user opt-out. Receipts and password resets always send.
const NON_ESSENTIAL: Record<string, keyof {
  email_marketing_opt_in: boolean;
  email_promotions_opt_in: boolean;
  email_product_updates_opt_in: boolean;
}> = {
  welcome: "email_marketing_opt_in",
};

const ngn = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 })
    .format(Number(n) || 0);

const formatRef = (ref: string) => {
  const clean = String(ref || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!clean) return "";
  return clean.match(/.{1,4}/g)!.join("-");
};

const formatDateNG = (d: Date) =>
  d.toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });

interface WelcomePayload {
  type: "welcome";
  to: string;
  name?: string;
}

interface ReceiptPayload {
  type: "receipt";
  to: string;
  name?: string;
  reference: string;
  amount: number;
  transaction_type: string;
  paid_at?: string;
  status?: string;
  network?: string;
  phone_number?: string;
  plan_name?: string;
  meter_number?: string;
  meter_type?: string;
  token?: string;
  cable_provider?: string;
  cable_smartcard?: string;
  new_balance?: number;
  payment_method?: string;
}

interface PasswordResetPayload {
  type: "password_reset";
  to: string;
  name?: string;
  reset_at?: string;
  ip?: string;
}

type Payload = WelcomePayload | ReceiptPayload | PasswordResetPayload;

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.match(/@(eagles\.local|phone\.harmicglobal\.com)$/);

const escape = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const shell = (b: Branding, title: string, inner: string, unsubUrl?: string) => `
<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:${b.dark_color};">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,${b.primary_color} 0%,${b.dark_color} 100%);border-radius:12px 12px 0 0;padding:28px 24px;text-align:center;">
      ${
        b.logo_url
          ? `<img src="${escape(b.logo_url)}" alt="${escape(b.brand_name)}" style="height:56px;border-radius:8px;background:#ffffff;padding:6px;"/>`
          : `<div style="display:inline-block;background:#ffffff;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;">${escape(b.logo_emoji || DEFAULT_EMOJI)}</div>`
      }
      <h1 style="margin:12px 0 0;color:#ffffff;font-size:22px;letter-spacing:0.3px;">${escape(b.brand_name)}</h1>
      ${b.header_tagline ? `<p style="margin:6px 0 0;color:#e2e8f0;font-size:13px;">${escape(b.header_tagline)}</p>` : ""}
    </div>
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px 28px;box-shadow:0 4px 14px rgba(15,23,42,0.06);">
      <h2 style="font-size:20px;color:${b.dark_color};margin:0 0 16px;">${escape(title)}</h2>
      ${inner}
    </div>
    <p style="margin-top:24px;font-size:12px;color:#64748b;text-align:center;line-height:1.6;">
      Need help? Reach us at <a href="mailto:${b.support_email}" style="color:${b.primary_color};text-decoration:none;">${escape(b.support_email)}</a><br/>
      ${b.footer_text ? `${escape(b.footer_text)}<br/>` : ""}
      &copy; ${new Date().getFullYear()} ${escape(b.brand_name)}. All rights reserved.
      ${unsubUrl ? `<br/><a href="${escape(unsubUrl)}" style="color:#94a3b8;">Unsubscribe from non-essential emails</a>` : ""}
    </p>
  </div>
</body></html>`;

const welcomeHtml = (b: Branding, t: TemplateCopy, name: string | undefined, unsubUrl?: string) =>
  shell(
    b,
    "Welcome aboard!",
    `
    <p style="font-size:15px;line-height:1.6;">Hi <strong>${escape(name || "there")}</strong>,</p>
    <p style="font-size:15px;line-height:1.6;">${escape(t.intro)}</p>
    <div style="background:#f0fdf4;border-left:4px solid ${b.primary_color};padding:14px 16px;margin:20px 0;border-radius:6px;">
      <p style="margin:0;font-size:14px;line-height:1.6;">
        🎁 <strong>Refer & earn ₦1,000</strong> — invite a friend, both get bonuses on their first purchase.
      </p>
    </div>
    <p style="font-size:15px;line-height:1.6;">${escape(t.outro)}</p>
    <p style="margin-top:24px;font-size:15px;">Cheers,<br/><strong>${escape(b.brand_name)} Team</strong></p>
  `,
    unsubUrl,
  );

const prettyType = (t: string) =>
  ({
    airtime: "Airtime Purchase",
    data: "Data Bundle",
    electricity: "Electricity Bill",
    cable_tv: "Cable TV Subscription",
    exam_pin: "Exam PIN Purchase",
    internet: "Internet Subscription",
    wallet_topup: "Wallet Top-up",
  }[t] || t.replace(/_/g, " "));

const receiptHtml = (b: Branding, t: TemplateCopy, p: ReceiptPayload) => {
  const paidAt = p.paid_at ? new Date(p.paid_at) : new Date();
  const status = (p.status || "successful").toLowerCase();
  const statusColor = status === "successful" || status === "completed" ? b.primary_color : "#f59e0b";

  const details: Array<[string, string | undefined]> = [
    ["Service", prettyType(p.transaction_type)],
    ["Network", p.network?.toUpperCase()],
    ["Plan", p.plan_name],
    ["Phone Number", p.phone_number],
    ["Meter Number", p.meter_number],
    ["Meter Type", p.meter_type],
    ["Token", p.token],
    ["Cable Provider", p.cable_provider?.toUpperCase()],
    ["Smartcard", p.cable_smartcard],
    ["Payment Method", p.payment_method],
    ["Wallet Balance", p.new_balance !== undefined ? ngn(p.new_balance) : undefined],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");

  const detailRows = details
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 0;color:#64748b;font-size:14px;">${escape(k)}</td><td style="padding:10px 0;text-align:right;font-weight:600;font-size:14px;color:${b.dark_color};">${escape(v)}</td></tr>`,
    )
    .join("");

  return shell(
    b,
    "Payment Receipt",
    `
    <p style="font-size:15px;line-height:1.6;">Hi <strong>${escape(p.name || "there")}</strong>,</p>
    <p style="font-size:15px;line-height:1.6;">${escape(t.intro)} Status: <span style="color:${statusColor};font-weight:600;text-transform:capitalize;">${escape(status)}</span>.</p>

    <div style="background:#f8fafc;border-radius:10px;padding:20px 22px;margin:18px 0;text-align:center;">
      <div style="font-size:13px;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;">Amount Paid</div>
      <div style="font-size:32px;font-weight:700;color:${b.primary_color};margin-top:6px;">${ngn(p.amount)}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:8px;">${escape(formatDateNG(paidAt))}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      ${detailRows}
      <tr><td style="padding:10px 0;color:#64748b;font-size:14px;border-top:1px dashed #e2e8f0;">Reference</td><td style="padding:10px 0;text-align:right;font-family:monospace;font-size:13px;color:${b.dark_color};border-top:1px dashed #e2e8f0;">${escape(formatRef(p.reference))}</td></tr>
    </table>

    <p style="margin-top:24px;font-size:14px;line-height:1.6;color:#475569;">${escape(t.outro)}</p>
    <p style="font-size:14px;">Thanks for choosing <strong>${escape(b.brand_name)}</strong>. ${escape(b.logo_emoji || "")}</p>
  `,
  );
};

const passwordResetHtml = (b: Branding, t: TemplateCopy, p: PasswordResetPayload) => {
  const at = p.reset_at ? new Date(p.reset_at) : new Date();
  return shell(
    b,
    "Your password was changed",
    `
    <p style="font-size:15px;line-height:1.6;">Hi <strong>${escape(p.name || "there")}</strong>,</p>
    <p style="font-size:15px;line-height:1.6;">${escape(t.intro)}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;">
      <tr><td style="padding:12px 16px;color:#64748b;font-size:14px;">When</td><td style="padding:12px 16px;text-align:right;font-weight:600;font-size:14px;">${escape(formatDateNG(at))}</td></tr>
      ${p.ip ? `<tr><td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">IP</td><td style="padding:12px 16px;text-align:right;font-weight:600;font-size:14px;border-top:1px solid #e2e8f0;">${escape(p.ip)}</td></tr>` : ""}
    </table>
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 16px;border-radius:6px;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#991b1b;">
        <strong>Didn't do this?</strong> Contact <a href="mailto:${b.support_email}" style="color:#991b1b;">${escape(b.support_email)}</a> immediately to secure your account.
      </p>
    </div>
    <p style="margin-top:20px;font-size:14px;">${escape(t.outro)}<br/><br/>Stay safe,<br/><strong>${escape(b.brand_name)} Team</strong></p>
  `,
  );
};

async function sendResend(from: string, to: string, subject: string, html: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error("Resend gateway error", res.status, body);
    throw new Error(`Resend failed (${res.status})`);
  }
  return body;
}

function fallbackBranding(): Branding {
  return {
    brand_name: DEFAULT_BRAND,
    logo_url: null,
    logo_emoji: DEFAULT_EMOJI,
    primary_color: DEFAULT_PRIMARY,
    dark_color: DEFAULT_DARK,
    header_tagline: "",
    footer_text: "",
    support_email: DEFAULT_SUPPORT,
    from_address: DEFAULT_FROM,
  };
}

function fallbackTemplate(type: string): TemplateCopy {
  if (type === "welcome")
    return {
      subject: "Welcome to HARMIC RECHARGE 🦅",
      intro: "Your HARMIC RECHARGE account is ready.",
      outro: "Log in anytime and fund your wallet to get started.",
      enabled: true,
    };
  if (type === "receipt")
    return {
      subject: "Your HARMIC RECHARGE Receipt",
      intro: "Your transaction was processed.",
      outro: "Keep this email as proof of payment.",
      enabled: true,
    };
  return {
    subject: "Your HARMIC RECHARGE password was reset",
    intro: "The password for your account was just reset successfully.",
    outro: "If you did not do this, contact support immediately.",
    enabled: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey!,
    );
    let callerUserId: string | null = null;
    let callerEmail: string | null = null;
    let callerIsAdmin = false;
    const isServiceCaller = token === serviceRoleKey;
    // Allow internal edge-function callers using the service role key.
    if (!isServiceCaller) {
      const { data: userData, error: userError } = await adminClient.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerUserId = userData.user.id;
      callerEmail = userData.user.email ?? null;
      const { data: isAdminData } = await adminClient.rpc("has_role", {
        _user_id: callerUserId,
        _role: "admin",
      });
      callerIsAdmin = !!isAdminData;
    }

    const payload = (await req.json()) as Payload;
    if (!payload?.to || !isValidEmail(payload.to)) {
      return new Response(JSON.stringify({ error: "Invalid recipient email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non-admin end users may only send email to their own address.
    if (!isServiceCaller && !callerIsAdmin) {
      const { data: ownProfile } = await adminClient
        .from("profiles")
        .select("email, contact_email")
        .eq("user_id", callerUserId)
        .maybeSingle();
      const allowed = [ownProfile?.email, ownProfile?.contact_email, callerEmail]
        .filter(Boolean)
        .map((e) => String(e).toLowerCase());
      if (!allowed.includes(payload.to.toLowerCase())) {
        return new Response(JSON.stringify({ error: "Not allowed to email this recipient" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load branding + template copy
    const [{ data: brandRow }, { data: tplRow }] = await Promise.all([
      adminClient.from("email_settings").select("*").limit(1).maybeSingle(),
      adminClient.from("email_templates").select("*").eq("template_key", payload.type).maybeSingle(),
    ]);
    const branding: Branding = brandRow ? { ...fallbackBranding(), ...brandRow } : fallbackBranding();
    const tpl: TemplateCopy = tplRow ?? fallbackTemplate(payload.type);

    const logAttempt = async (
      status: "sent" | "skipped" | "failed",
      opts: { subject?: string; reference?: string; skipped_reason?: string; error?: string; metadata?: Record<string, unknown> } = {},
    ) => {
      try {
        await adminClient.from("email_send_log").insert({
          template_type: payload.type,
          recipient_email: payload.to,
          subject: opts.subject ?? null,
          reference: opts.reference ?? null,
          status,
          skipped_reason: opts.skipped_reason ?? null,
          error_message: opts.error ?? null,
          metadata: opts.metadata ?? null,
        });
      } catch (e) {
        console.error("email_send_log insert failed", e);
      }
    };

    if (tpl.enabled === false) {
      await logAttempt("skipped", { skipped_reason: "template_disabled", subject: tpl.subject });
      return new Response(JSON.stringify({ skipped: "template_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Opt-out check for non-essential emails
    let unsubUrl: string | undefined;
    if (payload.type in NON_ESSENTIAL) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("email_marketing_opt_in, email_promotions_opt_in, email_product_updates_opt_in, unsubscribe_token")
        .eq("contact_email", payload.to)
        .maybeSingle();
      const prefKey = NON_ESSENTIAL[payload.type];
      if (profile && (profile as Record<string, unknown>)[prefKey] === false) {
        await logAttempt("skipped", { skipped_reason: "user_opted_out", subject: tpl.subject });
        return new Response(JSON.stringify({ skipped: "user_opted_out" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (profile?.unsubscribe_token) {
        const base = Deno.env.get("APP_PUBLIC_URL") || "https://the-eagles-charge.lovable.app";
        unsubUrl = `${base}/unsubscribe?token=${profile.unsubscribe_token}`;
      }
    }

    let subject = tpl.subject;
    let html = "";
    let reference: string | undefined;
    if (payload.type === "welcome") {
      html = welcomeHtml(branding, tpl, payload.name, unsubUrl);
    } else if (payload.type === "receipt") {
      subject = `${tpl.subject} • ${prettyType(payload.transaction_type)} • ${ngn(payload.amount)}`;
      html = receiptHtml(branding, tpl, payload);
      reference = payload.reference;
    } else if (payload.type === "password_reset") {
      html = passwordResetHtml(branding, tpl, payload);
    } else {
      return new Response(JSON.stringify({ error: "Unknown email type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await sendResend(branding.from_address || DEFAULT_FROM, payload.to, subject, html);
    } catch (e) {
      await logAttempt("failed", {
        subject,
        reference,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
    await logAttempt("sent", { subject, reference });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});