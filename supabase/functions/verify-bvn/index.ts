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

    console.log("CheckMyNINBVN raw response:", JSON.stringify(data).substring(0, 1000));

    if ((data.status === "success" || data.success) && (data.data || data.result)) {
      const d = data.data || data.result;
      console.log("BVN data keys:", Object.keys(d));

      const firstName = d.firstname || d.first_name || d.firstName || "";
      const middleName = d.middlename || d.middle_name || d.middleName || "";
      const lastName = d.lastname || d.last_name || d.lastName || d.surname || d.surName || "";
      const bvnNum = d.bvn || d.BVN || bvn.replace(/\D/g, "");
      const gender = d.gender || d.Gender || "";
      const dob = d.dob || d.date_of_birth || d.dateOfBirth || d.birthdate || "";
      const phone = d.phone || d.telephoneno || d.phoneNumber || d.mobile || "";
      const email = d.email || d.Email || "";
      const stateOfOrigin = d.state_of_origin || d.stateOfOrigin || d.self_origin_state || "";
      const stateOfResidence = d.state_of_residence || d.stateOfResidence || d.residence_state || "";
      const nationality = d.nationality || d.Nationality || "Nigerian";
      const photo = d.photo || d.image || d.picture || d.base64Image || null;
      const address = d.address || d.residence_address || d.residentialAddress || "";

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            full_name: [firstName, middleName, lastName].filter(Boolean).join(" "),
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            bvn: bvnNum,
            gender: gender,
            date_of_birth: dob,
            phone: phone,
            email: email,
            state_of_origin: stateOfOrigin,
            state_of_residence: stateOfResidence,
            nationality: nationality,
            address: address,
            photo: photo,
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
