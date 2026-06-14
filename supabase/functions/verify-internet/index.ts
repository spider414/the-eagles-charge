import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  account_number: string;
  provider: string;
}

// VTPass serviceID mapping for internet providers
const VTPASS_INTERNET_IDS: Record<string, string> = {
  smile: "smile-direct",
  spectranet: "spectranet",
  ipnx: "ipnx",
  swift: "swift-4g",
  ntel: "ntel",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { account_number, provider }: VerifyRequest = await req.json();

    console.log(`Verifying internet account: ${account_number} for provider: ${provider}`);

    if (!account_number || !provider) {
      return new Response(
        JSON.stringify({ error: "Account number and provider are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (account_number.length < 5 || account_number.length > 50) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Invalid account number format. Please check and try again.",
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

    const serviceID = VTPASS_INTERNET_IDS[provider.toLowerCase()];
    if (!serviceID) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid internet provider" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authString = btoa(`${vtpassApiKey}:${vtpassPublicKey}`);

    // Smile uses email-based verification, Spectranet uses phone/account number
    let verifyUrl: string;
    let verifyBody: Record<string, string>;

    if (provider.toLowerCase() === "smile") {
      // Smile verifies by email
      verifyUrl = "https://vtpass.com/api/merchant-verify/smile/email";
      verifyBody = {
        billersCode: account_number,
        serviceID: serviceID,
      };
    } else {
      // Spectranet and others use standard merchant-verify
      verifyUrl = "https://vtpass.com/api/merchant-verify";
      verifyBody = {
        billersCode: account_number,
        serviceID: serviceID,
      };
    }

    console.log(`Calling VTPass verify API: ${verifyUrl} with serviceID: ${serviceID}`);

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(verifyBody),
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
          error: "Unable to verify account. Service temporarily unavailable.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (verifyData.code === "000" && verifyData.content) {
      const content = verifyData.content;
      const customerName = content.Customer_Name || content.customer_name || "Customer";
      const accountId = content.AccountId || content.account_id || content.AccountList?.accountId;

      console.log(`Verification successful: ${customerName}`);

      return new Response(
        JSON.stringify({
          valid: true,
          customer_name: customerName,
          account_id: accountId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMessage =
        verifyData.content?.error ||
        verifyData.response_description ||
        verifyData.message ||
        "Invalid account number. Please verify and try again.";

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
        error: "Failed to verify account. Please try again.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
