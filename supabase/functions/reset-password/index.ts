import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetRequest {
  phone_number: string;
  new_password: string;
  verification_id?: string;
  security_answer?: string;
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
    const { phone_number, new_password, verification_id, security_answer }: ResetRequest = await req.json();

    if (!phone_number || !new_password) {
      return new Response(
        JSON.stringify({ error: "Phone number and new password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check rate limit before processing
    const rateLimitCheck = await checkRateLimit(supabase, phone_number, "reset-password");
    if (!rateLimitCheck.allowed) {
      console.log(`Rate limit exceeded for reset-password: ${phone_number}`);
      return new Response(
        JSON.stringify({
          error: "Too many failed attempts. Please contact customer support for assistance.",
          contactSupport: true,
          lockedUntil: rateLimitCheck.lockedUntil,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the user profile by phone number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, security_question, security_answer")
      .eq("phone_number", phone_number)
      .maybeSingle();

    if (profileError || !profile) {
      const failResult = await recordFailedAttempt(supabase, phone_number, "reset-password");
      const errorMessage = failResult.locked
        ? "Too many failed attempts. Please contact customer support for assistance."
        : `No account found with this phone number. (${failResult.attemptsRemaining} attempts remaining)`;
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          contactSupport: failResult.locked,
          attemptsRemaining: failResult.attemptsRemaining,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper function to hash security answer (SHA-256)
    async function hashSecurityAnswer(answer: string): Promise<string> {
      const normalized = answer.toLowerCase().trim();
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Verify either OTP verification or security answer
    let verified = false;

    if (verification_id) {
      // Verify using OTP
      const { data: otpRecord } = await supabase
        .from("otp_verifications")
        .select("*")
        .eq("id", verification_id)
        .eq("phone_number", phone_number)
        .eq("purpose", "password_reset")
        .eq("verified", true)
        .maybeSingle();

      if (otpRecord) {
        verified = true;
        // Clean up the OTP record
        await supabase
          .from("otp_verifications")
          .delete()
          .eq("id", verification_id);
      }
    } else if (security_answer && profile.security_answer) {
      // Verify using security answer - compare hashes
      const hashedInput = await hashSecurityAnswer(security_answer);
      // Check if stored answer is already hashed (64 hex chars) or plaintext
      const storedAnswer = profile.security_answer;
      const isStoredHashed = /^[a-f0-9]{64}$/i.test(storedAnswer);
      
      if (isStoredHashed) {
        // Compare hashes
        if (hashedInput === storedAnswer.toLowerCase()) {
          verified = true;
        }
      } else {
        // Legacy plaintext comparison (case-insensitive)
        if (security_answer.toLowerCase().trim() === storedAnswer.toLowerCase().trim()) {
          verified = true;
        }
      }
    }

    if (!verified) {
      const failResult = await recordFailedAttempt(supabase, phone_number, "reset-password");
      const errorMessage = failResult.locked
        ? "Too many failed attempts. Please contact customer support for assistance."
        : `Verification failed. Please verify your identity first. (${failResult.attemptsRemaining} attempts remaining)`;

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          contactSupport: failResult.locked,
          attemptsRemaining: failResult.attemptsRemaining,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success - clear rate limit and update password
    await clearRateLimit(supabase, phone_number, "reset-password");

    // Update the password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: new_password }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update password. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Best-effort password-reset confirmation email
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, contact_email, email")
        .eq("user_id", profile.user_id)
        .maybeSingle();
      const isReal = (e?: string | null) =>
        !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.match(/@(eagles\.local|phone\.harmicglobal\.com)$/);
      const to = isReal(prof?.contact_email)
        ? prof!.contact_email!
        : isReal(prof?.email)
          ? prof!.email!
          : "";
      if (to) {
        const ip =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("cf-connecting-ip") ||
          undefined;
        await supabase.functions.invoke("send-email", {
          body: {
            type: "password_reset",
            to,
            name: prof?.full_name ?? null,
            reset_at: new Date().toISOString(),
            ip,
          },
        });
      }
    } catch (mailErr) {
      console.warn("Password reset email failed:", mailErr);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Password reset successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in reset-password:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
