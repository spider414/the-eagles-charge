// Shared OTP audit logging helpers.
// Phone numbers are never stored in plaintext — only a SHA-256 hash plus a
// masked hint (e.g. 080****678) so admins can correlate reports.

export async function hashPhone(phone: string): Promise<string> {
  const digits = (phone || "").replace(/\D/g, "");
  const data = new TextEncoder().encode(`otp-audit:${digits}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function maskPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

export type OtpAuditEvent = "send" | "verify_success" | "verify_failure";

// deno-lint-ignore no-explicit-any
export async function logOtpEvent(
  supabase: any,
  params: {
    event: OtpAuditEvent;
    phone: string;
    purpose?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("otp_audit_log").insert({
      event_type: params.event,
      phone_hash: await hashPhone(params.phone),
      phone_hint: maskPhone(params.phone),
      purpose: params.purpose ?? null,
      reason: params.reason ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error("Failed to write OTP audit log:", err);
  }
}
