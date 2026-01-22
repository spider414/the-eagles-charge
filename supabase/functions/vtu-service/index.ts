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

type RequestBody = AirtimeRequest | DataRequest | ElectricityRequest | CableTVRequest | BalanceRequest;

// VTU Provider configuration - Update these based on your provider
const VTU_CONFIG = {
  baseUrl: Deno.env.get("VTU_BASE_URL") || "https://vtu.ng/wp-json/api/v2",
  apiKey: Deno.env.get("CHEAPDATAHUB_API_KEY") || "",
};

// Helper to call VTU API
async function callVtuApi(endpoint: string, params: Record<string, string | number>) {
  const url = new URL(`${VTU_CONFIG.baseUrl}${endpoint}`);
  
  // For GET requests, append params to URL
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });

  console.log(`VTU API Call: ${url.toString()}`);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${VTU_CONFIG.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();
  console.log("VTU API Response:", JSON.stringify(data));
  return data;
}

// Alternative POST method for APIs that require POST
async function callVtuApiPost(endpoint: string, body: Record<string, string | number>) {
  const url = `${VTU_CONFIG.baseUrl}${endpoint}`;
  
  console.log(`VTU API POST: ${url}`, JSON.stringify(body));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${VTU_CONFIG.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

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
        const result = await callVtuApi("/balance", {});
        return new Response(
          JSON.stringify({ success: true, data: result }),
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

    // Purchase Airtime
    if (body.action === "airtime") {
      const { phone, network, amount, transaction_id } = body;
      
      console.log(`Processing airtime: ${network} ${amount} for ${phone}`);

      try {
        // Generate unique request ID
        const requestId = `AIR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const result = await callVtuApiPost("/airtime", {
          request_id: requestId,
          phone: phone,
          service_id: network.toLowerCase(),
          amount: amount,
        });

        // Update transaction with API response
        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: result.code === "success" ? "completed" : "failed",
          })
          .eq("id", transaction_id);

        if (result.code === "success") {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Airtime delivered successfully!",
              data: result.data 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || "Airtime purchase failed");
        }
      } catch (error) {
        console.error("Airtime purchase error:", error);
        
        // Update transaction as failed
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
          service_id: network.toLowerCase(),
          variation_id: plan_code,
        });

        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: result.code === "success" ? "completed" : "failed",
          })
          .eq("id", transaction_id);

        if (result.code === "success") {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Data bundle delivered successfully!",
              data: result.data 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || "Data purchase failed");
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
          service_id: provider.toLowerCase(),
          amount: amount,
          meter_type: meter_type,
        });

        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: result.code === "success" ? "completed" : "failed",
            token: result.data?.token || null,
          })
          .eq("id", transaction_id);

        if (result.code === "success") {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Electricity payment successful!",
              data: result.data,
              token: result.data?.token
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || "Electricity payment failed");
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
          service_id: provider.toLowerCase(),
          variation_id: plan_code,
        });

        await supabase
          .from("transactions")
          .update({
            api_response: result,
            status: result.code === "success" ? "completed" : "failed",
          })
          .eq("id", transaction_id);

        if (result.code === "success") {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Cable TV subscription successful!",
              data: result.data 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || "Cable TV subscription failed");
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