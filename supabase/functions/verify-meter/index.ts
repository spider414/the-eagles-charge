import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  meter_number: string;
  provider: string;
  meter_type: "prepaid" | "postpaid";
}

// Electricity DisCo to Provider ID mapping (same as vtu-service)
const ELECTRICITY_PROVIDER_IDS: Record<string, number> = {
  aedc: 1,
  ekedc: 2,
  ibedc: 3,
  ikedc: 4,
  kedco: 5,
  phedc: 6,
  jedc: 7,
  eedc: 8,
  yedc: 9,
  bedc: 10,
  kaedco: 5, // Map kaedco to same as kedco if needed
};

serve(async (req) => {
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

    // Validate meter number format (typically 11-13 digits)
    if (meter_number.length < 10 || meter_number.length > 15) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Invalid meter number format. Please check and try again." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("CHEAPDATAHUB2_API_KEY");
    if (!apiKey) {
      console.error("CHEAPDATAHUB2_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const providerId = ELECTRICITY_PROVIDER_IDS[provider.toLowerCase()];
    if (!providerId) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid electricity provider" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the CheapDataHub verification API
    const verifyUrl = "https://www.cheapdatahub.ng/api/v1/resellers/electricity/validate/";
    
    console.log(`Calling verification API: ${verifyUrl}`);
    
    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        provider_id: providerId,
        meter_number: meter_number,
        meter_type: meter_type || "prepaid",
      }),
    });

    const responseText = await verifyResponse.text();
    console.log(`Verification API response status: ${verifyResponse.status}`);
    console.log(`Verification API response: ${responseText.substring(0, 500)}`);

    // Try to parse as JSON
    let verifyData;
    try {
      verifyData = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse verification response:", responseText.substring(0, 200));
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Unable to verify meter. Service temporarily unavailable." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if verification was successful
    const isSuccess = verifyData.status === "success" || 
                      verifyData.success === true || 
                      verifyData.code === "000" ||
                      verifyData.customer_name ||
                      verifyData.data?.customer_name;

    if (isSuccess) {
      const customerName = verifyData.customer_name || 
                          verifyData.data?.customer_name || 
                          verifyData.name ||
                          verifyData.data?.name;
      
      const customerAddress = verifyData.address || 
                             verifyData.data?.address || 
                             verifyData.customer_address ||
                             verifyData.data?.customer_address;

      const outstandingBalance = verifyData.outstanding || 
                                verifyData.data?.outstanding ||
                                verifyData.arrears ||
                                verifyData.data?.arrears;

      console.log(`Verification successful: ${customerName}, Address: ${customerAddress}`);

      return new Response(
        JSON.stringify({
          valid: true,
          customer_name: customerName || "Customer",
          customer_address: customerAddress,
          outstanding_balance: outstandingBalance,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMessage = verifyData.message || 
                          verifyData.error || 
                          verifyData.data?.message ||
                          "Invalid meter number. Please verify and try again.";
      
      console.log(`Verification failed: ${errorMessage}`);
      
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
