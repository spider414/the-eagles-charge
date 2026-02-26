import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number } = await req.json();

    if (!phone_number || typeof phone_number !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone number format
    const cleanPhone = phone_number.replace(/\D/g, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid phone number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("CHECKMYNINBVN_API_KEY");
    if (!apiKey) {
      console.error("CHECKMYNINBVN_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Verification service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying NIN for phone: ${cleanPhone.substring(0, 4)}****`);

    const response = await fetch("https://checkmyninbvn.com.ng/api/nin-phone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        consent: true,
      }),
    });

    const responseText = await response.text();
    console.log(`CheckMyNINBVN response status: ${response.status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse response:", responseText.substring(0, 200));
      return new Response(
        JSON.stringify({ success: false, error: "Verification service temporarily unavailable" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data.status === "success" && data.data) {
      const { firstname, middlename, surname, nin, gender, birthdate, photo } = data.data;
      const fullName = [firstname, middlename, surname].filter(Boolean).join(" ");

      console.log(`NIN verification successful for: ${firstname} ${surname}`);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            full_name: fullName,
            first_name: firstname || "",
            middle_name: middlename || "",
            last_name: surname || "",
            nin: nin || "",
            gender: gender || "",
            date_of_birth: birthdate || "",
            photo: photo || null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMessage = data.message || "NIN verification failed. No NIN found for this phone number.";
      console.log(`NIN verification failed: ${errorMessage}`);

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("NIN verification error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Verification failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
