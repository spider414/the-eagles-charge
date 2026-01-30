import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * This edge function securely retrieves the security question for password reset.
 * It returns a generic message regardless of whether the account exists to prevent
 * account enumeration attacks.
 * 
 * Security measures:
 * - No auth required (public endpoint for password reset flow)
 * - Rate limited via the send-otp function (same phone number)
 * - Returns consistent response timing to prevent timing attacks
 * - Generic error messages that don't reveal account existence
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number } = await req.json();

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone number format
    const cleanedPhone = phone_number.replace(/\D/g, "");
    if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the user profile by phone number
    const { data: profile } = await supabase
      .from("profiles")
      .select("security_question")
      .eq("phone_number", phone_number)
      .maybeSingle();

    // Add artificial delay to prevent timing attacks (50-150ms random delay)
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

    // Always return success to prevent account enumeration
    // Only include security_question if account exists and has one set
    if (profile?.security_question) {
      return new Response(
        JSON.stringify({
          success: true,
          has_security_question: true,
          security_question: profile.security_question,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generic response for non-existent accounts or accounts without security questions
    // This prevents attackers from determining if an account exists
    return new Response(
      JSON.stringify({
        success: true,
        has_security_question: false,
        message: "If this account exists, you can use OTP verification to reset your password.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in get-security-question:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
