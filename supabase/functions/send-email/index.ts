import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_ADDRESS = "The Eagles Charge <noreply@harmicglobal.com>";

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
}

type Payload = WelcomePayload | ReceiptPayload;

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
<html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #16a34a;">
      <h1 style="margin:0;color:#16a34a;font-size:22px;">The Eagles Charge</h1>
    </div>
    <h2 style="font-size:20px;color:#0f172a;margin-top:24px;">${escape(title)}</h2>
    ${inner}
    <p style="margin-top:32px;font-size:12px;color:#64748b;text-align:center;">
      &copy; ${new Date().getFullYear()} The Eagles Charge. All rights reserved.
    </p>
  </div>
</body></html>`;

const welcomeHtml = (name?: string) =>
  shell(
    "Welcome aboard! 🦅",
    `
    <p>Hi ${escape(name || "there")},</p>
    <p>Thanks for creating your <strong>Eagles Charge</strong> account. You're all set to buy airtime, data, pay bills, and more — instantly.</p>
    <p>Log in anytime and fund your wallet to get started.</p>
    <p style="margin-top:24px;">Cheers,<br/>The Eagles Charge Team</p>
  `,
  );

const receiptHtml = (p: ReceiptPayload) => {
  const paidAt = p.paid_at ? new Date(p.paid_at) : new Date();
  const rows = [
    ["Reference", p.reference],
    ["Type", p.transaction_type.replace(/_/g, " ")],
    ["Amount", `₦${Number(p.amount).toLocaleString()}`],
    ["Date", paidAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#64748b;">${escape(k)}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escape(v)}</td></tr>`,
    )
    .join("");
  return shell(
    "Payment Receipt",
    `
    <p>Hi ${escape(p.name || "there")},</p>
    <p>We've received your payment. Here are the details:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
      ${rows}
    </table>
    <p style="margin-top:24px;">Keep this email for your records.</p>
    <p>Thanks for choosing The Eagles Charge.</p>
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
      subject = `Receipt • ${payload.reference}`;
      html = receiptHtml(payload);
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