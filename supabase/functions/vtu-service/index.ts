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

// VTU Provider configuration - CheapDataHub API
// NOTE: Update VTU_BASE_URL secret if using a different VTU provider
const VTU_CONFIG = {
  baseUrl: Deno.env.get("VTU_BASE_URL") || "https://www.cheapdatahub.ng/api/v1",
  apiKey: Deno.env.get("CHEAPDATAHUB_API_KEY") || "",
};

// Helper to call VTU API with GET
async function callVtuApi(endpoint: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${VTU_CONFIG.baseUrl}${endpoint}`);
  
  // Add API key to params
  url.searchParams.append("api_key", VTU_CONFIG.apiKey);
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });

  const logUrl = url.toString().replace(VTU_CONFIG.apiKey, "***");
  console.log(`VTU API Call: ${logUrl}`);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });

  // Check if response is JSON
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error("VTU API returned non-JSON response:", text.substring(0, 200));
    throw new Error(`VTU API returned invalid response (${response.status}). Check API URL and key configuration.`);
  }

  const data = await response.json();
  console.log("VTU API Response:", JSON.stringify(data));
  return data;
}

// POST method for APIs that require POST
async function callVtuApiPost(endpoint: string, body: Record<string, string | number>) {
  const url = `${VTU_CONFIG.baseUrl}${endpoint}`;
  
  // Add API key to body
  const requestBody = {
    ...body,
    api_key: VTU_CONFIG.apiKey,
  };
  
  console.log(`VTU API POST: ${url}`, JSON.stringify({ ...requestBody, api_key: "***" }));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  // Check if response is JSON
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error("VTU API returned non-JSON response:", text.substring(0, 200));
    throw new Error(`VTU API returned invalid response (${response.status}). Check API URL and key configuration.`);
  }

  const data = await response.json();
  console.log("VTU API Response:", JSON.stringify(data));
  return data;
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
        const result = await callVtuApi("/balance");
        
        // CheapDataHub returns balance in a specific format
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: {
              balance: result.balance || result.data?.balance || 0,
              currency: "NGN",
              raw: result
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Balance check error:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to check VTU balance" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch Data Plans for a network
    if (body.action === "data_plans") {
      const { network } = body;
      
      try {
        // CheapDataHub endpoint for data plans
        const result = await callVtuApi("/data", { network: network.toLowerCase() });
        
        // Transform the response to a standard format
        let plans = [];
        
        if (result.status === "success" && result.data) {
          plans = result.data.map((plan: {
            variation_id: string;
            name: string;
            variation_amount: number;
            fixedPrice: string;
            validity?: string;
          }) => ({
            id: plan.variation_id,
            name: plan.name,
            size: plan.name,
            price: parseFloat(plan.fixedPrice) || plan.variation_amount,
            validity: plan.validity || "30 days",
            variation_id: plan.variation_id,
          }));
        } else if (Array.isArray(result)) {
          // Alternative response format
          plans = result.map((plan: {
            id: string;
            variation_id: string;
            name: string;
            price: number;
            amount: number;
            validity?: string;
          }) => ({
            id: plan.id || plan.variation_id,
            name: plan.name,
            size: plan.name,
            price: plan.price || plan.amount,
            validity: plan.validity || "30 days",
            variation_id: plan.variation_id || plan.id,
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
          JSON.stringify({ success: false, error: "Failed to fetch data plans" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Purchase Airtime
    if (body.action === "airtime") {
      const { phone, network, amount, transaction_id } = body;
      
      console.log(`Processing airtime: ${network} ${amount} for ${phone}`);

      try {
        const requestId = `AIR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const result = await callVtuApiPost("/airtime", {
          request_id: requestId,
          phone: phone,
          network: network.toLowerCase(),
          amount: amount,
        });

        // Update transaction with API response
        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: result.status === "success" || result.code === "success" ? "completed" : "failed",
          })
          .eq("id", transaction_id);

        if (result.status === "success" || result.code === "success") {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Airtime delivered successfully!",
              data: result.data 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || result.error || "Airtime purchase failed");
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

    // Purchase Data
    if (body.action === "data") {
      const { phone, network, plan_code, amount, transaction_id } = body;
      
      console.log(`Processing data: ${network} ${plan_code} for ${phone}`);

      try {
        const requestId = `DATA-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const result = await callVtuApiPost("/data", {
          request_id: requestId,
          phone: phone,
          network: network.toLowerCase(),
          plan: plan_code,
        });

        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: result.status === "success" || result.code === "success" ? "completed" : "failed",
          })
          .eq("id", transaction_id);

        if (result.status === "success" || result.code === "success") {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Data bundle delivered successfully!",
              data: result.data 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || result.error || "Data purchase failed");
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

    // Electricity Bill Payment
    if (body.action === "electricity") {
      const { meter_number, provider, amount, meter_type, transaction_id } = body;
      
      console.log(`Processing electricity: ${provider} ${amount} for meter ${meter_number}`);

      try {
        const requestId = `ELEC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const result = await callVtuApiPost("/electricity", {
          request_id: requestId,
          meter_number: meter_number,
          disco: provider.toLowerCase(),
          amount: amount,
          meter_type: meter_type,
        });

        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: result.status === "success" || result.code === "success" ? "completed" : "failed",
            token: result.data?.token || result.token || null,
          })
          .eq("id", transaction_id);

        if (result.status === "success" || result.code === "success") {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Electricity payment successful!",
              data: result.data,
              token: result.data?.token || result.token
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || result.error || "Electricity payment failed");
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

    // Cable TV Subscription
    if (body.action === "cable_tv") {
      const { smartcard_number, provider, plan_code, amount, transaction_id } = body;
      
      console.log(`Processing cable TV: ${provider} ${plan_code} for ${smartcard_number}`);

      try {
        const requestId = `TV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const result = await callVtuApiPost("/tv", {
          request_id: requestId,
          smartcard_number: smartcard_number,
          cable: provider.toLowerCase(),
          plan: plan_code,
        });

        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: result.status === "success" || result.code === "success" ? "completed" : "failed",
          })
          .eq("id", transaction_id);

        if (result.status === "success" || result.code === "success") {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Cable TV subscription successful!",
              data: result.data 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || result.error || "Cable TV subscription failed");
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