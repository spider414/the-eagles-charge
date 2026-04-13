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

interface DataPlansRequest {
  action: "data_plans";
  network: string;
}

interface ExamPinProductsRequest {
  action: "exam_pin_products";
}

interface ExamPinPurchaseRequest {
  action: "exam_pin";
  product_id: number;
  quantity: number;
  transaction_id: string;
}

type RequestBody = AirtimeRequest | DataRequest | ElectricityRequest | CableTVRequest | DataPlansRequest | ExamPinProductsRequest | ExamPinPurchaseRequest;

// CheapDataHub API Configuration - Using new Bearer auth
const VTU_CONFIG = {
  baseUrl: "https://www.cheapdatahub.ng/api/v1/resellers",
  apiKey: Deno.env.get("CHEAPDATAHUB2_API_KEY") || "",
};

// Network to Provider ID mapping
const NETWORK_PROVIDER_IDS: Record<string, number> = {
  mtn: 1,
  glo: 2,
  airtel: 3,
  "9mobile": 4,
};

// Electricity DisCo to Provider ID mapping
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
};

// Cable TV Provider ID mapping
const CABLE_PROVIDER_IDS: Record<string, number> = {
  gotv: 1,
  dstv: 2,
  startimes: 3,
};

// Hardcoded data plans with bundle IDs
const DATA_PLANS: Record<string, Array<{
  id: string;
  bundle_id: number;
  name: string;
  size: string;
  price: number;
  validity: string;
}>> = {
  mtn: [
    { id: "43", bundle_id: 43, name: "110MB - 1 Day", size: "110MB", price: 99, validity: "1 Day" },
    { id: "44", bundle_id: 44, name: "500MB - 30 Days", size: "500MB", price: 385, validity: "30 Days" },
    { id: "45", bundle_id: 45, name: "1GB - 7 Days", size: "1GB", price: 455, validity: "7 Days" },
    { id: "46", bundle_id: 46, name: "1GB - 30 Days", size: "1GB", price: 560, validity: "30 Days" },
    { id: "47", bundle_id: 47, name: "2GB - 7 Days", size: "2GB", price: 930, validity: "7 Days" },
    { id: "27", bundle_id: 27, name: "2.5GB - 2 Days", size: "2.5GB", price: 900, validity: "2 Days" },
    { id: "60", bundle_id: 60, name: "3.5GB - 1 Day", size: "3.5GB", price: 980, validity: "1 Day" },
    { id: "48", bundle_id: 48, name: "2GB - 30 Days", size: "2GB", price: 1150, validity: "30 Days" },
    { id: "61", bundle_id: 61, name: "4GB - 2 Days", size: "4GB", price: 1175, validity: "2 Days" },
    { id: "49", bundle_id: 49, name: "3GB - 30 Days", size: "3GB", price: 1370, validity: "30 Days" },
    { id: "50", bundle_id: 50, name: "5GB - 30 Days", size: "5GB", price: 2050, validity: "30 Days" },
    { id: "53", bundle_id: 53, name: "6GB - 7 Days", size: "6GB", price: 2495, validity: "7 Days" },
    { id: "55", bundle_id: 55, name: "11GB - 7 Days", size: "11GB", price: 3430, validity: "7 Days" },
    { id: "33", bundle_id: 33, name: "7GB - 30 Days", size: "7GB", price: 3499, validity: "30 Days" },
    { id: "57", bundle_id: 57, name: "36GB - 30 Days", size: "36GB", price: 10800, validity: "30 Days" },
    { id: "51", bundle_id: 51, name: "75GB - 30 Days", size: "75GB", price: 17990, validity: "30 Days" },
    { id: "56", bundle_id: 56, name: "165GB - 30 Days", size: "165GB", price: 34300, validity: "30 Days" },
  ],
  glo: [
    { id: "42", bundle_id: 42, name: "200MB - 1 Day", size: "200MB", price: 89, validity: "1 Day" },
    { id: "35", bundle_id: 35, name: "500MB - 30 Days", size: "500MB", price: 225, validity: "30 Days" },
    { id: "36", bundle_id: 36, name: "1GB - 30 Days", size: "1GB", price: 425, validity: "30 Days" },
    { id: "41", bundle_id: 41, name: "1GB - 14 Days", size: "1GB", price: 485, validity: "14 Days" },
    { id: "40", bundle_id: 40, name: "2GB - 30 Days", size: "2GB", price: 840, validity: "30 Days" },
    { id: "37", bundle_id: 37, name: "3GB - 30 Days", size: "3GB", price: 1290, validity: "30 Days" },
    { id: "54", bundle_id: 54, name: "5GB - 7 Days", size: "5GB", price: 1690, validity: "7 Days" },
    { id: "38", bundle_id: 38, name: "5GB - 30 Days", size: "5GB", price: 2190, validity: "30 Days" },
    { id: "39", bundle_id: 39, name: "10GB - 30 Days", size: "10GB", price: 4390, validity: "30 Days" },
    { id: "59", bundle_id: 59, name: "20.5GB - 30 Days", size: "20.5GB", price: 5300, validity: "30 Days" },
    { id: "58", bundle_id: 58, name: "107GB - 30 Days", size: "107GB", price: 19300, validity: "30 Days" },
  ],
  airtel: [
    { id: "13", bundle_id: 13, name: "500MB - 7 Days", size: "500MB", price: 490, validity: "7 Days" },
    { id: "14", bundle_id: 14, name: "1.5GB - 2 Days", size: "1.5GB", price: 599, validity: "2 Days" },
    { id: "15", bundle_id: 15, name: "1GB - 7 Days", size: "1GB", price: 785, validity: "7 Days" },
    { id: "17", bundle_id: 17, name: "2GB - 30 Days", size: "2GB", price: 1470, validity: "30 Days" },
    { id: "52", bundle_id: 52, name: "5GB - 7 Days", size: "5GB", price: 1570, validity: "7 Days" },
    { id: "18", bundle_id: 18, name: "3GB - 30 Days", size: "3GB", price: 1960, validity: "30 Days" },
    { id: "22", bundle_id: 22, name: "6GB - 7 Days", size: "6GB", price: 2455, validity: "7 Days" },
    { id: "19", bundle_id: 19, name: "4GB - 30 Days", size: "4GB", price: 2570, validity: "30 Days" },
    { id: "20", bundle_id: 20, name: "8GB - 30 Days", size: "8GB", price: 2999, validity: "30 Days" },
    { id: "21", bundle_id: 21, name: "10GB - 30 Days", size: "10GB", price: 4070, validity: "30 Days" },
  ],
  "9mobile": [
    // 9mobile plans - using estimated bundle IDs based on pattern
    { id: "70", bundle_id: 70, name: "500MB - 30 Days", size: "500MB", price: 450, validity: "30 Days" },
    { id: "71", bundle_id: 71, name: "1GB - 30 Days", size: "1GB", price: 800, validity: "30 Days" },
    { id: "72", bundle_id: 72, name: "1.5GB - 30 Days", size: "1.5GB", price: 1000, validity: "30 Days" },
    { id: "73", bundle_id: 73, name: "2GB - 30 Days", size: "2GB", price: 1200, validity: "30 Days" },
    { id: "74", bundle_id: 74, name: "3GB - 30 Days", size: "3GB", price: 1500, validity: "30 Days" },
    { id: "75", bundle_id: 75, name: "4.5GB - 30 Days", size: "4.5GB", price: 2000, validity: "30 Days" },
    { id: "76", bundle_id: 76, name: "11GB - 30 Days", size: "11GB", price: 4000, validity: "30 Days" },
    { id: "77", bundle_id: 77, name: "15GB - 30 Days", size: "15GB", price: 5000, validity: "30 Days" },
  ],
};

// Cable TV plans with bundle IDs
const CABLE_PLANS: Record<string, Array<{
  id: string;
  bundle_id: number;
  name: string;
  price: number;
}>> = {
  dstv: [
    { id: "3", bundle_id: 3, name: "DStv Padi", price: 4400 },
  ],
  gotv: [
    { id: "4", bundle_id: 4, name: "GOtv Smallie Monthly", price: 1900 },
  ],
  startimes: [
    { id: "5", bundle_id: 5, name: "Nova (Antenna) - 1 Week", price: 700 },
  ],
};

// POST method for CheapDataHub API with Bearer auth
async function callVtuApiPost(endpoint: string, body: Record<string, string | number>) {
  const url = `${VTU_CONFIG.baseUrl}${endpoint}`;
  
  console.log(`VTU API POST: ${url}`, JSON.stringify(body));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${VTU_CONFIG.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type");
  const responseText = await response.text();
  
  console.log(`VTU API Response Status: ${response.status}`);
  console.log(`VTU API Response: ${responseText.substring(0, 500)}`);

  if (!contentType || !contentType.includes("application/json")) {
    console.error("VTU API returned non-JSON response:", responseText.substring(0, 200));
    throw new Error(`VTU API returned invalid response (${response.status}). The service may be temporarily unavailable.`);
  }

  try {
    const data = JSON.parse(responseText);
    return data;
  } catch {
    throw new Error(`Failed to parse VTU API response: ${responseText.substring(0, 100)}`);
  }
}

// GET method for CheapDataHub API with Bearer auth
async function callVtuApiGet(endpoint: string) {
  const url = `${VTU_CONFIG.baseUrl}${endpoint}`;
  console.log(`VTU API GET: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${VTU_CONFIG.apiKey}`,
    },
  });

  const responseText = await response.text();
  console.log(`VTU API Response Status: ${response.status}`);
  console.log(`VTU API Response: ${responseText.substring(0, 500)}`);

  try {
    return JSON.parse(responseText);
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

    // Fetch Data Plans for a network (returns hardcoded plans)
    if (body.action === "data_plans") {
      const { network } = body;
      const networkKey = network.toLowerCase();
      const plans = DATA_PLANS[networkKey] || [];
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: plans.map(plan => ({
            id: plan.id,
            name: plan.name,
            size: plan.size,
            price: plan.price,
            validity: plan.validity,
            variation_id: plan.bundle_id.toString(),
          }))
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Purchase Airtime
    if (body.action === "airtime") {
      const { phone, network, amount, transaction_id } = body;
      
      const providerId = NETWORK_PROVIDER_IDS[network.toLowerCase()];
      if (!providerId) {
        throw new Error(`Invalid network: ${network}`);
      }

      console.log(`Processing airtime: provider_id=${providerId} amount=${amount} for ${phone}`);

      try {
        const result = await callVtuApiPost("/airtime/purchase/", {
          provider_id: providerId,
          phone_number: phone,
          amount: amount,
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

    // Purchase Data
    if (body.action === "data") {
      const { phone, network, plan_code, transaction_id } = body;
      
      // plan_code is the bundle_id
      const bundleId = parseInt(plan_code, 10);
      if (isNaN(bundleId)) {
        throw new Error(`Invalid bundle ID: ${plan_code}`);
      }

      console.log(`Processing data: bundle_id=${bundleId} for ${phone}`);

      try {
        const result = await callVtuApiPost("/data/purchase/", {
          bundle_id: bundleId,
          phone_number: phone,
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

    // Electricity Bill Payment
    if (body.action === "electricity") {
      const { meter_number, provider, amount, meter_type, transaction_id } = body;
      
      const providerId = ELECTRICITY_PROVIDER_IDS[provider.toLowerCase()];
      if (!providerId) {
        throw new Error(`Invalid electricity provider: ${provider}`);
      }

      console.log(`Processing electricity: provider_id=${providerId} amount=${amount} for meter ${meter_number}`);

      try {
        const result = await callVtuApiPost("/electricity/purchase/", {
          provider_id: providerId,
          meter_number: meter_number,
          amount: amount,
          meter_type: meter_type.toLowerCase(),
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

    // Cable TV Subscription
    if (body.action === "cable_tv") {
      const { smartcard_number, provider, plan_code, transaction_id } = body;
      
      // plan_code is the bundle_id for cable
      const bundleId = parseInt(plan_code, 10);
      if (isNaN(bundleId)) {
        throw new Error(`Invalid cable plan ID: ${plan_code}`);
      }

      console.log(`Processing cable TV: bundle_id=${bundleId} for ${smartcard_number}`);

      try {
        const result = await callVtuApiPost("/cable/purchase/", {
          bundle_id: bundleId,
          iuc_number: smartcard_number,
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

    // Fetch Exam PIN Products
    if (body.action === "exam_pin_products") {
      try {
        const result = await callVtuApiGet("/exam-pin/products/");
        return new Response(
          JSON.stringify({ success: true, data: result.data || result }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to fetch exam products" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Purchase Exam PIN
    if (body.action === "exam_pin") {
      const { product_id, quantity, transaction_id } = body;

      if (!product_id || ![1, 2, 5].includes(quantity)) {
        throw new Error("Invalid product_id or quantity (must be 1, 2, or 5)");
      }

      console.log(`Processing exam pin: product_id=${product_id} quantity=${quantity}`);

      try {
        const result = await callVtuApiPost("/exam-pin/purchase/", {
          product_id,
          quantity,
        });

        const isSuccess = result.status === "success" || result.status === "true" || result.success === true;

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
              message: "Exam PIN purchased successfully!",
              data: result.data || result,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          throw new Error(result.message || result.error || "Exam PIN purchase failed");
        }
      } catch (error) {
        console.error("Exam PIN purchase error:", error);

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
            error: error instanceof Error ? error.message : "Exam PIN purchase failed",
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
