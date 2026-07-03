import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_ADDRESS = "The Eagles Charge <noreply@harmicglobal.com>";
const SUPPORT_EMAIL = "support@harmicglobal.com";
const BRAND_PRIMARY = "#16a34a";
const BRAND_DARK = "#0f172a";

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
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith("@eagles.local");

const escape = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const shell = (title: string, inner: string) => `
<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:${BRAND_DARK};">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,${BRAND_PRIMARY} 0%,#065f46 100%);border-radius:12px 12px 0 0;padding:28px 24px;text-align:center;">
      <div style="display:inline-block;background:#ffffff;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;">🦅</div>
      <h1 style="margin:12px 0 0;color:#ffffff;font-size:22px;letter-spacing:0.3px;">The Eagles Charge</h1>
    </div>
    <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px 28px;box-shadow:0 4px 14px rgba(15,23,42,0.06);">
      <h2 style="font-size:20px;color:${BRAND_DARK};margin:0 0 16px;">${escape(title)}</h2>
      ${inner}
    </div>
    <p style="margin-top:24px;font-size:12px;color:#64748b;text-align:center;line-height:1.6;">
      Need help? Reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_PRIMARY};text-decoration:none;">${SUPPORT_EMAIL}</a><br/>
      &copy; ${new Date().getFullYear()} The Eagles Charge. All rights reserved.
    </p>
  </div>
</body></html>`;

const welcomeHtml = (name?: string) =>
  shell(
    "Welcome aboard!",
    `
    <p style="font-size:15px;line-height:1.6;">Hi <strong>${escape(name || "there")}</strong>,</p>
    <p style="font-size:15px;line-height:1.6;">Your <strong>Eagles Charge</strong> account is ready. Buy airtime, data, pay electricity, cable, and more — instantly, at the best rates.</p>
    <div style="background:#f0fdf4;border-left:4px solid ${BRAND_PRIMARY};padding:14px 16px;margin:20px 0;border-radius:6px;">
      <p style="margin:0;font-size:14px;line-height:1.6;">
        🎁 <strong>Refer & earn ₦1,000</strong> — invite a friend, both get bonuses on their first purchase.
      </p>
    </div>
    <p style="font-size:15px;line-height:1.6;">Log in anytime and fund your wallet to get started.</p>
    <p style="margin-top:24px;font-size:15px;">Cheers,<br/><strong>The Eagles Charge Team</strong></p>
  `,
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

const receiptHtml = (p: ReceiptPayload) => {
  const paidAt = p.paid_at ? new Date(p.paid_at) : new Date();
  const status = (p.status || "successful").toLowerCase();
  const statusColor = status === "successful" || status === "completed" ? BRAND_PRIMARY : "#f59e0b";

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
    ["Wallet Balance", p.new_balance !== undefined ? `₦${Number(p.new_balance).toLocaleString()}` : undefined],
  ].filter(([, v]) => v !== undefined && v !== null && v !== "");

  const detailRows = details
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 0;color:#64748b;font-size:14px;">${escape(k)}</td><td style="padding:10px 0;text-align:right;font-weight:600;font-size:14px;color:${BRAND_DARK};">${escape(v)}</td></tr>`,
    )
    .join("");

  return shell(
    "Payment Receipt",
    `
    <p style="font-size:15px;line-height:1.6;">Hi <strong>${escape(p.name || "there")}</strong>,</p>
    <p style="font-size:15px;line-height:1.6;">Your transaction was <span style="color:${statusColor};font-weight:600;text-transform:capitalize;">${escape(status)}</span>. Here's your receipt:</p>

    <div style="background:#f8fafc;border-radius:10px;padding:20px 22px;margin:18px 0;text-align:center;">
      <div style="font-size:13px;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;">Amount Paid</div>
      <div style="font-size:32px;font-weight:700;color:${BRAND_PRIMARY};margin-top:6px;">₦${Number(p.amount).toLocaleString()}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:8px;">${escape(paidAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" }))}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      ${detailRows}
      <tr><td style="padding:10px 0;color:#64748b;font-size:14px;border-top:1px dashed #e2e8f0;">Reference</td><td style="padding:10px 0;text-align:right;font-family:monospace;font-size:13px;color:${BRAND_DARK};border-top:1px dashed #e2e8f0;">${escape(p.reference)}</td></tr>
    </table>

    <p style="margin-top:24px;font-size:14px;line-height:1.6;color:#475569;">Keep this email as proof of payment. If anything looks off, reply to this email within 24 hours.</p>
    <p style="font-size:14px;">Thanks for choosing <strong>The Eagles Charge</strong>. 🦅</p>
  `,
  );
};

const passwordResetHtml = (p: PasswordResetPayload) => {
  const at = p.reset_at ? new Date(p.reset_at) : new Date();
  return shell(
    "Your password was changed",
    `
    <p style="font-size:15px;line-height:1.6;">Hi <strong>${escape(p.name || "there")}</strong>,</p>
    <p style="font-size:15px;line-height:1.6;">The password for your <strong>Eagles Charge</strong> account was just reset successfully.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;">
      <tr><td style="padding:12px 16px;color:#64748b;font-size:14px;">When</td><td style="padding:12px 16px;text-align:right;font-weight:600;font-size:14px;">${escape(at.toLocaleString("en-NG", { timeZone: "Africa/Lagos" }))}</td></tr>
      ${p.ip ? `<tr><td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">IP</td><td style="padding:12px 16px;text-align:right;font-weight:600;font-size:14px;border-top:1px solid #e2e8f0;">${escape(p.ip)}</td></tr>` : ""}
    </table>
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 16px;border-radius:6px;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#991b1b;">
        <strong>Didn't do this?</strong> Contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#991b1b;">${SUPPORT_EMAIL}</a> immediately to secure your account.
      </p>
    </div>
    <p style="margin-top:20px;font-size:14px;">Stay safe,<br/><strong>The Eagles Charge Team</strong></p>
  `,
  );
};

async function sendResend(to: string, subject: string, html: string) {
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
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error("Resend gateway error", res.status, body);
    throw new Error(`Resend failed (${res.status})`);
  }
  return body;
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as Payload;
    if (!payload?.to || !isValidEmail(payload.to)) {
      return new Response(JSON.stringify({ error: "Invalid recipient email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject = "";
    let html = "";
    if (payload.type === "welcome") {
      subject = "Welcome to The Eagles Charge 🦅";
      html = welcomeHtml(payload.name);
    } else if (payload.type === "receipt") {
      subject = `Receipt • ${prettyType(payload.transaction_type)} • ₦${Number(payload.amount).toLocaleString()}`;
      html = receiptHtml(payload);
    } else if (payload.type === "password_reset") {
      subject = "Your Eagles Charge password was reset";
      html = passwordResetHtml(payload);
    } else {
      return new Response(JSON.stringify({ error: "Unknown email type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sendResend(payload.to, subject, html);

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