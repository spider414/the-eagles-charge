import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  meter_number: string;
  provider: string;
  meter_type: "prepaid" | "postpaid";
}

// VTPass serviceID mapping for electricity DisCos
const VTPASS_ELECTRICITY_IDS: Record<string, string> = {
  ikedc: "ikeja-electric",
  ekedc: "eko-electric",
  aedc: "abuja-electric",
  phedc: "portharcourt-electric",
  kedco: "kano-electric",
  ibedc: "ibadan-electric",
  eedc: "enugu-electric",
  bedc: "benin-electric",
  jedc: "jos-electric",
  kaedco: "kaduna-electric",
  yedc: "yola-electric",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meter_number, provider, meter_type }: VerifyRequest = await req.json();

    console.log(`Verifying meter: ${meter_number} for provider: ${provider}, type: ${meter_type}`);

    if (!meter_number || !provider) {
      return new Response(
        JSON.stringify({ error: "Meter number and provider are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (meter_number.length < 10 || meter_number.length > 15) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Invalid meter number format. Please check and try again." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vtpassApiKey = Deno.env.get("VTPASS_API_KEY");
    const vtpassPublicKey = Deno.env.get("VTPASS_PUBLIC_KEY");
    
    if (!vtpassApiKey || !vtpassPublicKey) {
      console.error("VTPass credentials not configured");
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceID = VTPASS_ELECTRICITY_IDS[provider.toLowerCase()];
    if (!serviceID) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid electricity provider" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // VTPass uses Basic Authentication: api-key:public-key
    const authString = btoa(`${vtpassApiKey}:${vtpassPublicKey}`);
    
    const verifyUrl = "https://vtpass.com/api/merchant-verify";
    console.log(`Calling VTPass verify API: ${verifyUrl} with serviceID: ${serviceID}, type: ${meter_type}`);

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        billersCode: meter_number,
        serviceID: serviceID,
        type: meter_type || "prepaid",
      }),
    });

    const responseText = await verifyResponse.text();
    console.log(`VTPass response status: ${verifyResponse.status}`);
    console.log(`VTPass response: ${responseText.substring(0, 500)}`);

    let verifyData;
    try {
      verifyData = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse VTPass response:", responseText.substring(0, 200));
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Unable to verify meter. Service temporarily unavailable." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // VTPass returns code "000" for success (BILLER CONFIRMED)
    if (verifyData.code === "000" && verifyData.content) {
      const content = verifyData.content;
      const customerName = content.Customer_Name || content.customer_name || "Customer";
      const customerAddress = content.Address || content.address || content.Customer_Address;
      const meterNumber = content.Meter_Number || content.meter_number;
      const customerDistrict = content.Customer_District || content.district;

      console.log(`Verification successful: ${customerName}, Address: ${customerAddress}`);

      return new Response(
        JSON.stringify({
          valid: true,
          customer_name: customerName,
          customer_address: customerAddress,
          meter_number: meterNumber,
          district: customerDistrict,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMessage = verifyData.content?.error || 
                          verifyData.response_description ||
                          verifyData.message ||
                          "Invalid meter number. Please verify and try again.";
      
      console.log(`Verification failed - code: ${verifyData.code}, error: ${errorMessage}`);
      
      return new Response(
        JSON.stringify({
          valid: false,
          error: errorMessage,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: "Failed to verify meter. Please try again." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
