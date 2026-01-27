import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OtpRequest {
  phone_number: string;
  purpose: "signup" | "password_reset";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, purpose }: OtpRequest = await req.json();

    if (!phone_number || !purpose) {
      return new Response(
        JSON.stringify({ error: "Phone number and purpose are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number for Nigeria (add 234 prefix if needed)
    let formattedPhone = phone_number.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "234" + formattedPhone.slice(1);
    } else if (!formattedPhone.startsWith("234")) {
      formattedPhone = "234" + formattedPhone;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // For password reset, check if phone number exists
    if (purpose === "password_reset") {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", phone_number)
        .maybeSingle();

      if (!existingProfile) {
        return new Response(
          JSON.stringify({ error: "No account found with this phone number" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // For signup, check if phone number already exists
    if (purpose === "signup") {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", phone_number)
        .maybeSingle();

      if (existingProfile) {
        return new Response(
          JSON.stringify({ error: "This phone number is already registered" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clean up old OTPs for this phone number
    await supabase
      .from("otp_verifications")
      .delete()
      .eq("phone_number", phone_number)
      .eq("purpose", purpose);

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("otp_verifications")
      .insert({
        phone_number,
        otp_code: otpCode,
        purpose,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send OTP via Termii Token API (handles sender ID automatically)
    const termiiApiKey = Deno.env.get("TERMII_API_KEY");
    
    const termiiResponse = await fetch("https://api.ng.termii.com/api/sms/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: termiiApiKey,
        message_type: "NUMERIC",
        to: formattedPhone,
        from: "HERMIC PAY",
        channel: "dnd",
        pin_attempts: 3,
        pin_time_to_live: 10,
        pin_length: 6,
        pin_placeholder: "< 1234 >",
        message_text: `Your Eagles verification code is < 1234 >. Valid for 10 minutes. Do not share.`,
        pin_type: "NUMERIC",
      }),
    });

    const termiiResult = await termiiResponse.json();
    console.log("Termii Token API response:", termiiResult);

    if (!termiiResponse.ok || (termiiResult.status !== "success" && termiiResult.code !== "ok")) {
      console.error("Termii error:", termiiResult);
      
      // If Termii Token API fails, try the standard SMS endpoint
      console.log("Trying fallback SMS endpoint...");
      const fallbackResponse = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: termiiApiKey,
          to: formattedPhone,
          from: "HERMIC PAY",
          sms: `Your Eagles verification code is: ${otpCode}. Valid for 10 minutes.`,
          type: "plain",
          channel: "dnd",
        }),
      });
      
      const fallbackResult = await fallbackResponse.json();
      console.log("Fallback SMS response:", fallbackResult);
      
      if (!fallbackResponse.ok || fallbackResult.code !== "ok") {
        console.error("Fallback also failed:", fallbackResult);
        return new Response(
          JSON.stringify({ 
            error: "Failed to send OTP. Please check your Termii dashboard for registered sender IDs.",
            details: fallbackResult.message || termiiResult.message 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully",
        expires_in: 600 // seconds
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-otp:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
