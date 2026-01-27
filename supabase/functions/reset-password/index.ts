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

    // Find the user profile by phone number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, security_question, security_answer")
      .eq("phone_number", phone_number)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "No account found with this phone number" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      // Verify using security answer (case-insensitive)
      if (security_answer.toLowerCase().trim() === profile.security_answer.toLowerCase().trim()) {
        verified = true;
      }
    }

    if (!verified) {
      return new Response(
        JSON.stringify({ error: "Verification failed. Please verify your identity first." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
