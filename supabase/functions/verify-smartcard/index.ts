import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  smartcard_number: string;
  provider: "dstv" | "gotv" | "startimes";
}

// Cable TV Provider ID mapping (same as vtu-service)
const CABLE_PROVIDER_IDS: Record<string, number> = {
  gotv: 1,
  dstv: 2,
  startimes: 3,
};

// Try multiple possible endpoints for verification
const VERIFY_ENDPOINTS = [
  "/cable/verify/",
  "/cable/validate/",
  "/cable/verify-iuc/",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { smartcard_number, provider }: VerifyRequest = await req.json();

    console.log(`Verifying smartcard: ${smartcard_number} for provider: ${provider}`);

    if (!smartcard_number || !provider) {
      return new Response(
        JSON.stringify({ error: "Smartcard number and provider are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate smartcard number format
    if (smartcard_number.length < 10 || smartcard_number.length > 15) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Invalid smartcard number format. Please check and try again." 
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

    const providerId = CABLE_PROVIDER_IDS[provider];
    if (!providerId) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid provider" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = "https://www.cheapdatahub.ng/api/v1/resellers";
    
    // Try each verification endpoint until one works
    for (const endpoint of VERIFY_ENDPOINTS) {
      const verifyUrl = `${baseUrl}${endpoint}`;
      console.log(`Trying verification API: ${verifyUrl}`);
      
      try {
        const verifyResponse = await fetch(verifyUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            provider_id: providerId,
            iuc_number: smartcard_number,
          }),
        });

        console.log(`Response status for ${endpoint}: ${verifyResponse.status}`);

        // If 404, try next endpoint
        if (verifyResponse.status === 404) {
          console.log(`Endpoint ${endpoint} returned 404, trying next...`);
          continue;
        }

        const responseText = await verifyResponse.text();
        console.log(`Response body: ${responseText.substring(0, 500)}`);

        // Check if it's HTML (not JSON)
        if (responseText.trim().startsWith("<!") || responseText.trim().startsWith("<html")) {
          console.log(`Endpoint ${endpoint} returned HTML, trying next...`);
          continue;
        }

        // Try to parse as JSON
        let verifyData;
        try {
          verifyData = JSON.parse(responseText);
        } catch {
          console.error("Failed to parse response as JSON:", responseText.substring(0, 200));
          continue;
        }

        // Check if verification was successful
        const isSuccess = verifyData.status === "success" || 
                          verifyData.success === true || 
                          verifyData.code === "000" ||
                          verifyData.customer_name ||
                          verifyData.data?.customer_name ||
                          verifyData.data?.name;

        if (isSuccess) {
          const customerName = verifyData.customer_name || 
                              verifyData.data?.customer_name || 
                              verifyData.name ||
                              verifyData.data?.name;
          
          const currentPackage = verifyData.current_package || 
                                verifyData.data?.current_package || 
                                verifyData.package ||
                                verifyData.data?.package ||
                                verifyData.bouquet ||
                                verifyData.data?.bouquet ||
                                verifyData.current_bouquet ||
                                verifyData.data?.current_bouquet;

          const dueDate = verifyData.due_date || 
                         verifyData.data?.due_date ||
                         verifyData.renewal_date ||
                         verifyData.data?.renewal_date;

          console.log(`Verification successful: ${customerName}, Package: ${currentPackage}`);

          return new Response(
            JSON.stringify({
              valid: true,
              customer_name: customerName || "Customer",
              current_package: currentPackage,
              due_date: dueDate,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const errorMessage = verifyData.message || 
                              verifyData.error || 
                              verifyData.data?.message ||
                              "Invalid smartcard number. Please verify and try again.";
          
          console.log(`Verification failed: ${errorMessage}`);
          
          return new Response(
            JSON.stringify({
              valid: false,
              error: errorMessage,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (fetchErr) {
        console.error(`Error calling ${endpoint}:`, fetchErr);
        continue;
      }
    }

    // If all endpoints failed, return error
    console.error("All verification endpoints failed");
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: "Smartcard verification is currently unavailable. Please try again later." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: "Failed to verify smartcard. Please try again." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
