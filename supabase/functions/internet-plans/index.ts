import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// VTPass serviceID mapping for internet providers
const VTPASS_SERVICE_IDS: Record<string, string> = {
  smile: "smile-direct",
  spectranet: "spectranet",
  ipnx: "ipnx",
  swift: "swift-4g",
  ntel: "ntel",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider } = await req.json();

    if (!provider) {
      return new Response(
        JSON.stringify({ success: false, error: "Provider is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceID = VTPASS_SERVICE_IDS[provider.toLowerCase()];
    if (!serviceID) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid internet provider" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vtpassApiKey = Deno.env.get("VTPASS_API_KEY");
    const vtpassPublicKey = Deno.env.get("VTPASS_PUBLIC_KEY");

    if (!vtpassApiKey || !vtpassPublicKey) {
      console.error("VTPass credentials not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authString = btoa(`${vtpassApiKey}:${vtpassPublicKey}`);

    console.log(`Fetching plans for provider: ${provider}, serviceID: ${serviceID}`);

    const response = await fetch(
      `https://vtpass.com/api/service-variations?serviceID=${serviceID}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Basic ${authString}`,
          "Accept": "application/json",
        },
      }
    );

    const responseText = await response.text();
    console.log(`VTPass response status: ${response.status}`);
    console.log(`VTPass response preview: ${responseText.substring(0, 500)}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse VTPass response");
      return new Response(
        JSON.stringify({ success: false, error: "Service temporarily unavailable" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data.response_description === "000" || data.content?.varations?.length > 0) {
      const variations = data.content?.varations || data.content?.variations || [];

      const plans = variations.map((v: any, index: number) => ({
        id: v.variation_code || `${provider}-${index}`,
        name: v.name || v.fixedPrice || `Plan ${index + 1}`,
        price: Number(v.variation_amount) || 0,
        data: v.name || "N/A",
        validity: v.fixedPrice || "30 Days",
        variation_code: v.variation_code || "",
      }));

      console.log(`Found ${plans.length} plans for ${provider}`);

      return new Response(
        JSON.stringify({ success: true, data: plans }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.log(`No plans found for ${provider}: ${data.response_description}`);
      return new Response(
        JSON.stringify({ success: false, error: "No plans available for this provider" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error fetching internet plans:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch plans" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
