import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  smartcard_number: string;
  provider: "dstv" | "gotv" | "startimes";
}

// VTPass serviceID mapping
const VTPASS_SERVICE_IDS: Record<string, string> = {
  dstv: "dstv",
  gotv: "gotv",
  startimes: "startimes",
};

Deno.serve(async (req) => {
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

    if (smartcard_number.length < 10 || smartcard_number.length > 15) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Invalid smartcard number format. Please check and try again." 
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

    const serviceID = VTPASS_SERVICE_IDS[provider];
    if (!serviceID) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid provider" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // VTPass uses Basic Authentication: api-key:public-key
    const authString = btoa(`${vtpassApiKey}:${vtpassPublicKey}`);
    
    const verifyUrl = "https://vtpass.com/api/merchant-verify";
    console.log(`Calling VTPass verify API: ${verifyUrl} with serviceID: ${serviceID}`);

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        billersCode: smartcard_number,
        serviceID: serviceID,
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
          error: "Unable to verify smartcard. Service temporarily unavailable." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // VTPass returns code "000" for success (BILLER CONFIRMED)
    if (verifyData.code === "000" && verifyData.content) {
      const content = verifyData.content;
      const customerName = content.Customer_Name || content.customer_name || "Customer";
      const currentBouquet = content.Current_Bouquet || content.current_bouquet;
      const dueDate = content.Due_Date || content.due_date;
      const renewalAmount = content.Renewal_Amount || content.renewal_amount;
      const status = content.Status || content.status;

      console.log(`Verification successful: ${customerName}, Bouquet: ${currentBouquet}, Due: ${dueDate}`);

      return new Response(
        JSON.stringify({
          valid: true,
          customer_name: customerName,
          current_package: currentBouquet,
          due_date: dueDate,
          renewal_amount: renewalAmount,
          status: status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // VTPass error codes: 011 = invalid arguments, 012 = product not found, etc.
      const errorMessage = verifyData.content?.error || 
                          verifyData.response_description ||
                          verifyData.message ||
                          "Invalid smartcard number. Please verify and try again.";
      
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
        error: "Failed to verify smartcard. Please try again." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
