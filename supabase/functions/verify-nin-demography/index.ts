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
    const { firstname, lastname, gender, dob } = await req.json();

    if (!firstname || !lastname || !gender || !dob) {
      return new Response(
        JSON.stringify({ success: false, error: "First name, last name, gender, and date of birth are required" }),
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

    const response = await fetch("https://checkmyninbvn.com.ng/api/nin-demography", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        gender: gender.trim(),
        dob: dob.trim(),
        consent: true,
      }),
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
      console.log("NIN-demography data keys:", Object.keys(d));

      const firstName = d.firstname || d.first_name || d.firstName || "";
      const middleName = d.middlename || d.middle_name || d.middleName || "";
      const lastName = d.surname || d.last_name || d.lastName || d.surName || "";
      const ninNum = d.nin || d.NIN || "";
      const gender = d.gender || d.Gender || "";
      const dob = d.birthdate || d.date_of_birth || d.dateOfBirth || d.dob || "";
      const phone = d.telephoneno || d.phone || d.phoneNumber || d.mobile || "";
      const photo = d.photo || d.image || d.picture || d.base64Image || null;
      const email = d.email || d.Email || "";
      const state = d.residence_state || d.state || d.stateOfOrigin || d.state_of_origin || "";
      const address = d.residence_address || d.address || d.residentialAddress || "";
      const stateOfOrigin = d.self_origin_state || d.stateOfOrigin || d.state_of_origin || state || "";
      const nationality = d.nationality || d.Nationality || "Nigerian";

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            full_name: [firstName, middleName, lastName].filter(Boolean).join(" "),
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            nin: ninNum,
            gender: gender,
            date_of_birth: dob,
            phone: phone,
            email: email,
            state: state,
            state_of_origin: stateOfOrigin,
            state_of_residence: state,
            nationality: nationality,
            address: address,
            photo: photo,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: data.message || "Demography search failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("NIN demography error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Verification failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
