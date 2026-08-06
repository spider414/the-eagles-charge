import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";
import { logOtpEvent } from "../_shared/otp-audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hash OTP code using SHA-256 for secure comparison
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return encodeHex(new Uint8Array(hashBuffer));
}

interface VerifyRequest {
  phone_number: string;
  otp_code: string;
  purpose: "signup" | "password_reset";
}

// Normalize a Nigerian phone number to the same 0XXXXXXXXXX format
// that send-otp stores in the database.
function normalizePhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) return digits;
  if (digits.length === 13 && digits.startsWith("234")) return `0${digits.slice(3)}`;
  if (digits.length === 10) return `0${digits}`;
  return digits;
}

interface RateLimitRecord {
  id: string;
  identifier: string;
  endpoint: string;
  attempt_count: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

const MAX_FAILED_ATTEMPTS = 4;
const LOCKOUT_DURATION_MINUTES = 30;

interface RateLimitResult {
  allowed: boolean;
  attemptsRemaining?: number;
  lockedUntil?: string;
  contactSupport?: boolean;
}

// deno-lint-ignore no-explicit-any
async function checkRateLimit(
  supabase: any,
  identifier: string,
  endpoint: string
): Promise<RateLimitResult> {
  const { data: existing } = await supabase
    .from("rate_limit_attempts")
    .select("*")
    .eq("identifier", identifier)
    .eq("endpoint", endpoint)
    .maybeSingle() as { data: RateLimitRecord | null };

  if (!existing) {
    return { allowed: true, attemptsRemaining: MAX_FAILED_ATTEMPTS };
  }

  // Check if currently locked
  if (existing.locked_until && new Date(existing.locked_until) > new Date()) {
    return {
      allowed: false,
      lockedUntil: existing.locked_until,
      contactSupport: true,
    };
  }

  // If lock has expired, reset the counter
  if (existing.locked_until && new Date(existing.locked_until) <= new Date()) {
    await supabase
      .from("rate_limit_attempts")
      .delete()
      .eq("id", existing.id);
    return { allowed: true, attemptsRemaining: MAX_FAILED_ATTEMPTS };
  }

  const attemptsRemaining = MAX_FAILED_ATTEMPTS - existing.attempt_count;
  return { allowed: attemptsRemaining > 0, attemptsRemaining };
}

// deno-lint-ignore no-explicit-any
async function recordFailedAttempt(
  supabase: any,
  identifier: string,
  endpoint: string
): Promise<{ locked: boolean; attemptsRemaining: number }> {
  const { data: existing } = await supabase
    .from("rate_limit_attempts")
    .select("*")
    .eq("identifier", identifier)
    .eq("endpoint", endpoint)
    .maybeSingle() as { data: RateLimitRecord | null };

  if (!existing) {
    await supabase.from("rate_limit_attempts").insert({
      identifier,
      endpoint,
      attempt_count: 1,
    });
    return { locked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - 1 };
  }

  const newCount = existing.attempt_count + 1;
  const shouldLock = newCount >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString()
    : null;

  await supabase
    .from("rate_limit_attempts")
    .update({
      attempt_count: newCount,
      locked_until: lockedUntil,
    })
    .eq("id", existing.id);

  return {
    locked: shouldLock,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - newCount),
  };
}

// deno-lint-ignore no-explicit-any
async function clearRateLimit(
  supabase: any,
  identifier: string,
  endpoint: string
): Promise<void> {
  await supabase
    .from("rate_limit_attempts")
    .delete()
    .eq("identifier", identifier)
    .eq("endpoint", endpoint);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, otp_code, purpose }: VerifyRequest = await req.json();

    if (!phone_number || !otp_code || !purpose) {
      return new Response(
        JSON.stringify({ error: "Phone number, OTP code and purpose are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = normalizePhone(phone_number);
    const cleanOtp = String(otp_code).replace(/\D/g, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check rate limit before processing
    const rateLimitCheck = await checkRateLimit(supabase, normalizedPhone, "verify-otp");
    if (!rateLimitCheck.allowed) {
      console.log(`Rate limit exceeded for verify-otp: ${normalizedPhone}`);
      await logOtpEvent(supabase, {
        event: "verify_failure",
        phone: normalizedPhone,
        purpose,
        reason: "blocked: too many failed verification attempts",
      });
      return new Response(
        JSON.stringify({
          error: "Too many failed attempts. Please contact customer support for assistance.",
          contactSupport: true,
          canRetry: false,
          lockedUntil: rateLimitCheck.lockedUntil,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the most recent unverified OTP record (there can be several)
    const { data: otpRows, error: fetchError } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("phone_number", normalizedPhone)
      .eq("purpose", purpose)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1);

    const otpRecord = otpRows && otpRows.length > 0 ? otpRows[0] : null;

    if (fetchError || !otpRecord) {
      if (fetchError) console.error("OTP lookup error:", fetchError);
      const failResult = await recordFailedAttempt(supabase, normalizedPhone, "verify-otp");
      const errorMessage = failResult.locked
        ? "Too many failed attempts. Please contact customer support for assistance."
        : `No pending verification found. Please request a new OTP. (${failResult.attemptsRemaining} attempts remaining)`;
      await logOtpEvent(supabase, {
        event: "verify_failure",
        phone: normalizedPhone,
        purpose,
        reason: "no pending OTP found",
        metadata: { attempts_remaining: failResult.attemptsRemaining },
      });

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          contactSupport: failResult.locked,
          canRetry: !failResult.locked,
          needsNewCode: true,
          attemptsRemaining: failResult.attemptsRemaining,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase
        .from("otp_verifications")
        .delete()
        .eq("id", otpRecord.id);

      const failResult = await recordFailedAttempt(supabase, normalizedPhone, "verify-otp");
      const errorMessage = failResult.locked
        ? "Too many failed attempts. Please contact customer support for assistance."
        : `OTP has expired. Please request a new one. (${failResult.attemptsRemaining} attempts remaining)`;

      await logOtpEvent(supabase, {
        event: "verify_failure",
        phone: normalizedPhone,
        purpose,
        reason: "OTP expired",
        metadata: { attempts_remaining: failResult.attemptsRemaining },
      });

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          contactSupport: failResult.locked,
          canRetry: !failResult.locked,
          needsNewCode: true,
          attemptsRemaining: failResult.attemptsRemaining,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the input OTP and compare with stored hash
    const hashedInputOTP = await hashOTP(cleanOtp);
    
    // Verify OTP code (comparing hashes)
    if (otpRecord.otp_code !== hashedInputOTP) {
      const failResult = await recordFailedAttempt(supabase, normalizedPhone, "verify-otp");
      const errorMessage = failResult.locked
        ? "Too many failed attempts. Please contact customer support for assistance."
        : `Invalid OTP code. Please try again. (${failResult.attemptsRemaining} attempts remaining)`;

      await logOtpEvent(supabase, {
        event: "verify_failure",
        phone: normalizedPhone,
        purpose,
        reason: "invalid code",
        metadata: { attempts_remaining: failResult.attemptsRemaining },
      });

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          contactSupport: failResult.locked,
          canRetry: !failResult.locked,
          attemptsRemaining: failResult.attemptsRemaining,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success - clear rate limit and mark as verified
    await clearRateLimit(supabase, normalizedPhone, "verify-otp");
    await clearRateLimit(supabase, normalizedPhone, "send-otp");
    
    await supabase
      .from("otp_verifications")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    await logOtpEvent(supabase, {
      event: "verify_success",
      phone: normalizedPhone,
      purpose,
      reason: "verified",
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Phone number verified successfully",
        verification_id: otpRecord.id
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in verify-otp:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
