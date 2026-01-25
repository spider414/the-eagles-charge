import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AirtimeRequest {
  action: "airtime";
  phone: string;
  network: string;
  amount: number;
  transaction_id: string;
}

interface DataRequest {
  action: "data";
  phone: string;
  network: string;
  plan_code: string;
  amount: number;
  transaction_id: string;
}

interface ElectricityRequest {
  action: "electricity";
  meter_number: string;
  provider: string;
  amount: number;
  meter_type: string;
  transaction_id: string;
}

interface CableTVRequest {
  action: "cable_tv";
  smartcard_number: string;
  provider: string;
  plan_code: string;
  amount: number;
  transaction_id: string;
}

interface BalanceRequest {
  action: "balance";
}

interface DataPlansRequest {
  action: "data_plans";
  network: string;
}

type RequestBody = AirtimeRequest | DataRequest | ElectricityRequest | CableTVRequest | BalanceRequest | DataPlansRequest;

// CheapDataHub API Configuration
const VTU_CONFIG = {
  baseUrl: "https://www.cheapdatahub.ng/api/v1/resellers",
  apiKey: Deno.env.get("CHEAPDATAHUB_API_KEY") || "",
};

// POST method for CheapDataHub API
async function callVtuApiPost(endpoint: string, body: Record<string, string | number>) {
  const url = `${VTU_CONFIG.baseUrl}${endpoint}`;
  
  // CheapDataHub uses Authorization header with API key
  console.log(`VTU API POST: ${url}`, JSON.stringify({ ...body, api_key: "***" }));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Token ${VTU_CONFIG.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  // Check if response is JSON
  const contentType = response.headers.get("content-type");
  const responseText = await response.text();
  
  console.log(`VTU API Response Status: ${response.status}`);
  console.log(`VTU API Response: ${responseText.substring(0, 500)}`);

  if (!contentType || !contentType.includes("application/json")) {
    console.error("VTU API returned non-JSON response:", responseText.substring(0, 200));
    throw new Error(`VTU API returned invalid response (${response.status}). Check API URL and key configuration.`);
  }

  try {
    const data = JSON.parse(responseText);
    return data;
  } catch {
    throw new Error(`Failed to parse VTU API response: ${responseText.substring(0, 100)}`);
  }
}

// GET method for fetching data (balance, plans, etc.)
async function callVtuApiGet(endpoint: string) {
  const url = `${VTU_CONFIG.baseUrl}${endpoint}`;
  
  console.log(`VTU API GET: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Token ${VTU_CONFIG.apiKey}`,
    },
  });

  const responseText = await response.text();
  console.log(`VTU API Response Status: ${response.status}`);
  console.log(`VTU API Response: ${responseText.substring(0, 500)}`);

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error("VTU API returned non-JSON response:", responseText.substring(0, 200));
    throw new Error(`VTU API returned invalid response (${response.status}).`);
  }

  try {
    const data = JSON.parse(responseText);
    return data;
  } catch {
    throw new Error(`Failed to parse VTU API response: ${responseText.substring(0, 100)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();

    // Check VTU Balance
    if (body.action === "balance") {
      try {
        // Try to get balance from user profile endpoint
        const result = await callVtuApiGet("/user/");
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: {
              balance: result.wallet_balance || result.balance || 0,
              currency: "NGN",
              raw: result
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Balance check error:", error);
        return new Response(
          JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to check VTU balance" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch Data Plans for a network
    if (body.action === "data_plans") {
      const { network } = body;
      
      try {
        // CheapDataHub endpoint for data plans
        const result = await callVtuApiGet(`/data/plans/?network=${network.toLowerCase()}`);
        
        // Transform the response to a standard format
        let plans = [];
        
        if (Array.isArray(result)) {
          plans = result.map((plan: {
            id: string;
            plan_id: string;
            name: string;
            price: number;
            amount: number;
            validity?: string;
            duration?: string;
          }) => ({
            id: plan.id || plan.plan_id,
            name: plan.name,
            size: plan.name,
            price: plan.price || plan.amount,
            validity: plan.validity || plan.duration || "30 days",
            variation_id: plan.plan_id || plan.id,
          }));
        } else if (result.data && Array.isArray(result.data)) {
          plans = result.data.map((plan: {
            id: string;
            plan_id: string;
            name: string;
            price: number;
            amount: number;
            validity?: string;
            duration?: string;
          }) => ({
            id: plan.id || plan.plan_id,
            name: plan.name,
            size: plan.name,
            price: plan.price || plan.amount,
            validity: plan.validity || plan.duration || "30 days",
            variation_id: plan.plan_id || plan.id,
          }));
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: plans,
            raw: result
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Data plans fetch error:", error);
        return new Response(
          JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to fetch data plans" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Purchase Airtime - POST https://www.cheapdatahub.ng/api/v1/resellers/airtime/purchase/
    if (body.action === "airtime") {
      const { phone, network, amount, transaction_id } = body;
      
      console.log(`Processing airtime: ${network} ${amount} for ${phone}`);

      try {
        const result = await callVtuApiPost("/airtime/purchase/", {
          mobile_number: phone,
          network: network.toUpperCase(), // MTN, GLO, AIRTEL, 9MOBILE
          amount: amount,
          airtime_type: "VTU",
        });

        // Update transaction with API response
        const isSuccess = result.status === "success" || result.Status === "successful" || result.success === true;
        
        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: isSuccess ? "completed" : "failed",
          })
          .eq("id", transaction_id);

        if (isSuccess) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Airtime delivered successfully!",
              data: result 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || result.error || result.api_response || "Airtime purchase failed");
        }
      } catch (error) {
        console.error("Airtime purchase error:", error);
        
        await supabase
          .from("transactions")
          .update({
            status: "failed",
            api_response: { error: error instanceof Error ? error.message : "Unknown error" },
          })
          .eq("id", transaction_id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : "Airtime purchase failed" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Purchase Data - POST https://www.cheapdatahub.ng/api/v1/resellers/data/purchase/
    if (body.action === "data") {
      const { phone, network, plan_code, transaction_id } = body;
      
      console.log(`Processing data: ${network} ${plan_code} for ${phone}`);

      try {
        const result = await callVtuApiPost("/data/purchase/", {
          mobile_number: phone,
          network: network.toUpperCase(),
          plan: plan_code,
          ported_number: "true",
        });

        const isSuccess = result.status === "success" || result.Status === "successful" || result.success === true;

        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: isSuccess ? "completed" : "failed",
          })
          .eq("id", transaction_id);

        if (isSuccess) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Data bundle delivered successfully!",
              data: result 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || result.error || result.api_response || "Data purchase failed");
        }
      } catch (error) {
        console.error("Data purchase error:", error);
        
        await supabase
          .from("transactions")
          .update({
            status: "failed",
            api_response: { error: error instanceof Error ? error.message : "Unknown error" },
          })
          .eq("id", transaction_id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : "Data purchase failed" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Electricity Bill Payment - POST https://www.cheapdatahub.ng/api/v1/resellers/electricity/purchase/
    if (body.action === "electricity") {
      const { meter_number, provider, amount, meter_type, transaction_id } = body;
      
      console.log(`Processing electricity: ${provider} ${amount} for meter ${meter_number}`);

      try {
        const result = await callVtuApiPost("/electricity/purchase/", {
          meter_number: meter_number,
          disco_name: provider.toUpperCase(),
          amount: amount,
          meter_type: meter_type.toLowerCase(), // prepaid or postpaid
        });

        const isSuccess = result.status === "success" || result.Status === "successful" || result.success === true;

        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: isSuccess ? "completed" : "failed",
            token: result.token || result.Token || result.data?.token || null,
          })
          .eq("id", transaction_id);

        if (isSuccess) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Electricity payment successful!",
              data: result,
              token: result.token || result.Token || result.data?.token
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || result.error || result.api_response || "Electricity payment failed");
        }
      } catch (error) {
        console.error("Electricity payment error:", error);
        
        await supabase
          .from("transactions")
          .update({
            status: "failed",
            api_response: { error: error instanceof Error ? error.message : "Unknown error" },
          })
          .eq("id", transaction_id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : "Electricity payment failed" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Cable TV Subscription - POST https://www.cheapdatahub.ng/api/v1/resellers/cable/purchase/
    if (body.action === "cable_tv") {
      const { smartcard_number, provider, plan_code, transaction_id } = body;
      
      console.log(`Processing cable TV: ${provider} ${plan_code} for ${smartcard_number}`);

      try {
        const result = await callVtuApiPost("/cable/purchase/", {
          iuc_number: smartcard_number,
          cable_name: provider.toUpperCase(), // DSTV, GOTV, STARTIMES
          cable_plan: plan_code,
        });

        const isSuccess = result.status === "success" || result.Status === "successful" || result.success === true;

        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: isSuccess ? "completed" : "failed",
          })
          .eq("id", transaction_id);

        if (isSuccess) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Cable TV subscription successful!",
              data: result 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || result.error || result.api_response || "Cable TV subscription failed");
        }
      } catch (error) {
        console.error("Cable TV subscription error:", error);
        
        await supabase
          .from("transactions")
          .update({
            status: "failed",
            api_response: { error: error instanceof Error ? error.message : "Unknown error" },
          })
          .eq("id", transaction_id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : "Cable TV subscription failed" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("VTU service error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});