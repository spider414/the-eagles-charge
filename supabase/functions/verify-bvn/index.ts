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
    const { bvn } = await req.json();

    if (!bvn || typeof bvn !== "string" || bvn.replace(/\D/g, "").length !== 11) {
      return new Response(
        JSON.stringify({ success: false, error: "BVN must be exactly 11 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("CHECKMYNINBVN_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Verification service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://checkmyninbvn.com.ng/api/bvn-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ number: bvn.replace(/\D/g, ""), consent: true }),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Verification service temporarily unavailable" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data.status === "success" && data.data) {
      const { firstname, middlename, lastname, phone, email, bvn: bvnNum, dob, gender, state_of_origin, state_of_residence, nationality, photo } = data.data;
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            full_name: [firstname, middlename, lastname].filter(Boolean).join(" "),
            first_name: firstname || "",
            middle_name: middlename || "",
            last_name: lastname || "",
            bvn: bvnNum || bvn.replace(/\D/g, ""),
            gender: gender || "",
            date_of_birth: dob || "",
            phone: phone || "",
            email: email || "",
            state_of_origin: state_of_origin || "",
            state_of_residence: state_of_residence || "",
            nationality: nationality || "",
            photo: photo || null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: data.message || "BVN verification failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("BVN verification error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Verification failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
