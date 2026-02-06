import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  smartcard_number: string;
  provider: "dstv" | "gotv" | "startimes";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { smartcard_number, provider }: VerifyRequest = await req.json();

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

    const apiKey = Deno.env.get("CHEAPDATAHUB_API_KEY");
    if (!apiKey) {
      console.error("CHEAPDATAHUB_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map provider to API service ID
    const serviceMap: Record<string, string> = {
      dstv: "dstv",
      gotv: "gotv",
      startimes: "startimes",
    };

    const serviceId = serviceMap[provider];
    
    // Call the verification API
    const verifyResponse = await fetch("https://cheapdatahub.com.ng/api/cabletv/validate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: serviceId,
        smartcard_number: smartcard_number,
      }),
    });

    const verifyData = await verifyResponse.json();
    console.log("Verification response:", verifyData);

    // Check if verification was successful
    if (verifyData.status === "success" || verifyData.code === "000" || verifyData.customer_name) {
      return new Response(
        JSON.stringify({
          valid: true,
          customer_name: verifyData.customer_name || verifyData.data?.customer_name || verifyData.name,
          current_package: verifyData.current_package || verifyData.data?.current_package || verifyData.package || verifyData.bouquet,
          due_date: verifyData.due_date || verifyData.data?.due_date,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          valid: false,
          error: verifyData.message || verifyData.error || "Invalid smartcard number. Please verify and try again.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to verify smartcard. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
