import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OtpRequest {
  phone_number: string;
  purpose: "signup" | "password_reset";
}

// Valid Nigerian network prefixes (as of 2024)
const VALID_NIGERIAN_PREFIXES = [
  // MTN
  '703', '704', '706', '803', '806', '810', '813', '814', '816', '903', '906', '913', '916',
  // Glo
  '705', '805', '807', '811', '815', '905', '915',
  // Airtel
  '701', '708', '802', '808', '812', '901', '902', '904', '907', '912',
  // 9mobile
  '809', '817', '818', '908', '909'
];

interface PhoneValidationResult {
  valid: boolean;
  formatted: string;
  normalized: string;
  error?: string;
}

function validateNigerianPhone(phone: string): PhoneValidationResult {
  const digits = phone.replace(/\D/g, "");
  
  let normalized: string;
  if (digits.length === 11 && digits.startsWith("0")) {
    normalized = digits.slice(1);
  } else if (digits.length === 13 && digits.startsWith("234")) {
    normalized = digits.slice(3);
  } else if (digits.length === 10) {
    normalized = digits;
  } else {
    return { valid: false, formatted: "", normalized: "", error: "Invalid phone number length. Nigerian numbers should be 10-11 digits." };
  }
  
  // Validate the prefix
  const prefix = normalized.slice(0, 3);
  if (!VALID_NIGERIAN_PREFIXES.includes(prefix)) {
    return { valid: false, formatted: "", normalized: "", error: "Invalid Nigerian network prefix. Please use a valid MTN, Glo, Airtel, or 9mobile number." };
  }
  
  // Ensure it's exactly 10 digits after normalization
  if (normalized.length !== 10) {
    return { valid: false, formatted: "", normalized: "", error: "Invalid phone number format." };
  }
  
  return { valid: true, formatted: `+234${normalized}`, normalized: `0${normalized}` };
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

    // Validate purpose
    if (purpose !== "signup" && purpose !== "password_reset") {
      return new Response(
        JSON.stringify({ error: "Invalid purpose" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and format Nigerian phone number
    const phoneValidation = validateNigerianPhone(phone_number);
    if (!phoneValidation.valid) {
      return new Response(
        JSON.stringify({ error: phoneValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = phoneValidation.formatted;
    const normalizedPhone = phoneValidation.normalized;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limiting: Check recent OTP requests for this phone number
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentOtps, error: countError } = await supabase
      .from("otp_verifications")
      .select("created_at")
      .eq("phone_number", normalizedPhone)
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false });

    if (countError) {
      console.error("Error checking rate limit:", countError);
    }

    // Max 3 OTP requests per phone per hour
    if (recentOtps && recentOtps.length >= 3) {
      console.log(`Rate limit exceeded for phone: ${normalizedPhone}`);
      return new Response(
        JSON.stringify({ error: "Too many OTP requests. Please try again in 1 hour." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Minimum 60 seconds between OTP requests
    if (recentOtps && recentOtps.length > 0) {
      const lastOtpTime = new Date(recentOtps[0].created_at).getTime();
      const timeSinceLastOtp = Date.now() - lastOtpTime;
      
      if (timeSinceLastOtp < 60000) {
        const waitSeconds = Math.ceil((60000 - timeSinceLastOtp) / 1000);
        console.log(`Cooldown active for phone: ${normalizedPhone}, wait ${waitSeconds}s`);
        return new Response(
          JSON.stringify({ 
            error: `Please wait ${waitSeconds} seconds before requesting another OTP.` 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // For password reset, check if phone number exists
    if (purpose === "password_reset") {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_number", normalizedPhone)
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
        .eq("phone_number", normalizedPhone)
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

    // Clean up old OTPs for this phone number (keeping recent ones for rate limiting)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from("otp_verifications")
      .delete()
      .eq("phone_number", normalizedPhone)
      .eq("purpose", purpose)
      .lt("created_at", tenMinutesAgo);

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("otp_verifications")
      .insert({
        phone_number: normalizedPhone,
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

    // Send OTP via Twilio
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const messageBody = `Your Eagles verification code is: ${otpCode}. Valid for 10 minutes. Do not share this code.`;

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: twilioPhoneNumber,
        Body: messageBody,
      }),
    });

    const twilioResult = await twilioResponse.json();
    console.log("Twilio response:", JSON.stringify(twilioResult));

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioResult);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send OTP. Please try again.",
          details: twilioResult.message || "SMS delivery failed"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
