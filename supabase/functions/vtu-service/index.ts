import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAdminActivity } from "../_shared/admin.ts";
import { notifyAdminTransactionFailed } from "../_shared/notify-admin.ts";

const serviceClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

interface ProviderWalletBalanceRequest {
  action: "provider_wallet_balance";
}

type RequestBody = AirtimeRequest | DataRequest | ElectricityRequest | CableTVRequest | DataPlansRequest | ExamPinProductsRequest | ExamPinPurchaseRequest | ProviderWalletBalanceRequest;

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

// Hardcoded data plans with bundle IDs (synced with CheapDataHub official plan IDs)
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
    { id: "74", bundle_id: 74, name: "230MB - 1 Day", size: "230MB", price: 200, validity: "1 Day" },
    { id: "76", bundle_id: 76, name: "500MB SME - 2 Days", size: "500MB", price: 250, validity: "2 Days" },
    { id: "78", bundle_id: 78, name: "1GB SME - 1 Day", size: "1GB", price: 280, validity: "1 Day" },
    { id: "44", bundle_id: 44, name: "500MB SME - 30 Days", size: "500MB", price: 350, validity: "30 Days" },
    { id: "77", bundle_id: 77, name: "1GB SME - 2 Days", size: "1GB", price: 399, validity: "2 Days" },
    { id: "45", bundle_id: 45, name: "1GB SME - 7 Days", size: "1GB", price: 450, validity: "7 Days" },
    { id: "46", bundle_id: 46, name: "1GB SME - 30 Days", size: "1GB", price: 570, validity: "30 Days" },
    { id: "79", bundle_id: 79, name: "2.5GB SME - 1 Day", size: "2.5GB", price: 600, validity: "1 Day" },
    { id: "71", bundle_id: 71, name: "2GB Gifting - 7 Days", size: "2GB", price: 900, validity: "7 Days" },
    { id: "27", bundle_id: 27, name: "2.5GB - 2 Days", size: "2.5GB", price: 900, validity: "2 Days" },
    { id: "47", bundle_id: 47, name: "2GB SME - 7 Days", size: "2GB", price: 930, validity: "7 Days" },
    { id: "60", bundle_id: 60, name: "3.5GB - 1 Day", size: "3.5GB", price: 980, validity: "1 Day" },
    { id: "48", bundle_id: 48, name: "2GB SME - 30 Days", size: "2GB", price: 1150, validity: "30 Days" },
    { id: "61", bundle_id: 61, name: "4GB - 2 Days", size: "4GB", price: 1175, validity: "2 Days" },
    { id: "80", bundle_id: 80, name: "5GB Corporate Gifting - 14 Days", size: "5GB", price: 1299, validity: "14 Days" },
    { id: "49", bundle_id: 49, name: "3GB SME - 30 Days", size: "3GB", price: 1370, validity: "30 Days" },
    { id: "50", bundle_id: 50, name: "5GB SME - 30 Days", size: "5GB", price: 2050, validity: "30 Days" },
    { id: "53", bundle_id: 53, name: "6GB Gifting - 7 Days", size: "6GB", price: 2495, validity: "7 Days" },
    { id: "55", bundle_id: 55, name: "11GB Gifting - 7 Days", size: "11GB", price: 3430, validity: "7 Days" },
    { id: "33", bundle_id: 33, name: "7GB Gifting - 30 Days", size: "7GB", price: 3499, validity: "30 Days" },
    { id: "67", bundle_id: 67, name: "10GB Gifting - 30 Days", size: "10GB", price: 4470, validity: "30 Days" },
    { id: "57", bundle_id: 57, name: "36GB Gifting - 30 Days", size: "36GB", price: 10800, validity: "30 Days" },
    { id: "51", bundle_id: 51, name: "75GB SME - 30 Days", size: "75GB", price: 17990, validity: "30 Days" },
  ],
  glo: [
    { id: "42", bundle_id: 42, name: "200MB Corporate Gifting - 1 Day", size: "200MB", price: 92, validity: "1 Day" },
    { id: "35", bundle_id: 35, name: "500MB Corporate Gifting - 30 Days", size: "500MB", price: 225, validity: "30 Days" },
    { id: "68", bundle_id: 68, name: "1GB Corporate Gifting - 3 Days", size: "1GB", price: 300, validity: "3 Days" },
    { id: "36", bundle_id: 36, name: "1GB Corporate Gifting - 30 Days", size: "1GB", price: 425, validity: "30 Days" },
    { id: "41", bundle_id: 41, name: "1GB Gifting - 14 Days", size: "1GB", price: 485, validity: "14 Days" },
    { id: "40", bundle_id: 40, name: "2GB Corporate Gifting - 30 Days", size: "2GB", price: 850, validity: "30 Days" },
    { id: "37", bundle_id: 37, name: "3GB Corporate Gifting - 30 Days", size: "3GB", price: 1300, validity: "30 Days" },
    { id: "54", bundle_id: 54, name: "5GB Corporate Gifting - 7 Days", size: "5GB", price: 1699, validity: "7 Days" },
    { id: "38", bundle_id: 38, name: "5GB Corporate Gifting - 30 Days", size: "5GB", price: 2250, validity: "30 Days" },
    { id: "39", bundle_id: 39, name: "10GB Corporate Gifting - 30 Days", size: "10GB", price: 4390, validity: "30 Days" },
    { id: "59", bundle_id: 59, name: "20.5GB Gifting - 30 Days", size: "20.5GB", price: 5300, validity: "30 Days" },
    { id: "58", bundle_id: 58, name: "107GB Gifting - 30 Days", size: "107GB", price: 19300, validity: "30 Days" },
  ],
  airtel: [
    { id: "70", bundle_id: 70, name: "1GB Social Bundle Gifting - 3 Days", size: "1GB", price: 295, validity: "3 Days" },
    { id: "13", bundle_id: 13, name: "500MB Gifting - 7 Days", size: "500MB", price: 490, validity: "7 Days" },
    { id: "69", bundle_id: 69, name: "1.5GB Gifting - 1 Day", size: "1.5GB", price: 500, validity: "1 Day" },
    { id: "66", bundle_id: 66, name: "1.5GB Gifting - 2 Days", size: "1.5GB", price: 599, validity: "2 Days" },
    { id: "15", bundle_id: 15, name: "1GB Gifting - 7 Days", size: "1GB", price: 785, validity: "7 Days" },
    { id: "17", bundle_id: 17, name: "2GB Gifting - 30 Days", size: "2GB", price: 1470, validity: "30 Days" },
    { id: "52", bundle_id: 52, name: "5GB Gifting - 7 Days", size: "5GB", price: 1570, validity: "7 Days" },
    { id: "18", bundle_id: 18, name: "3GB Gifting - 30 Days", size: "3GB", price: 1960, validity: "30 Days" },
    { id: "22", bundle_id: 22, name: "6GB SME - 7 Days", size: "6GB", price: 2455, validity: "7 Days" },
    { id: "19", bundle_id: 19, name: "4GB Gifting - 30 Days", size: "4GB", price: 2570, validity: "30 Days" },
    { id: "20", bundle_id: 20, name: "8GB Gifting - 30 Days", size: "8GB", price: 2999, validity: "30 Days" },
    { id: "21", bundle_id: 21, name: "10GB Gifting - 30 Days", size: "10GB", price: 4070, validity: "30 Days" },
  ],
  // 9mobile plans are currently unavailable on CheapDataHub - check official plan IDs page for updates
  "9mobile": [],
};

// Cable TV plans with bundle IDs (synced with CheapDataHub official plan IDs)
const CABLE_PLANS: Record<string, Array<{
  id: string;
  bundle_id: number;
  name: string;
  price: number;
}>> = {
  dstv: [
    { id: "3", bundle_id: 3, name: "DStv Padi", price: 4400 },
    { id: "6", bundle_id: 6, name: "DStv Yanga", price: 6000 },
    { id: "7", bundle_id: 7, name: "DStv Confam", price: 11000 },
    { id: "8", bundle_id: 8, name: "DStv Compact", price: 19000 },
    { id: "9", bundle_id: 9, name: "DStv Compact Plus", price: 30000 },
    { id: "10", bundle_id: 10, name: "DStv Premium", price: 44500 },
  ],
  gotv: [
    { id: "4", bundle_id: 4, name: "GOtv Smallie Monthly", price: 1900 },
    { id: "11", bundle_id: 11, name: "GOtv Jinja", price: 3900 },
    { id: "12", bundle_id: 12, name: "GOtv Jolli", price: 5800 },
    { id: "13", bundle_id: 13, name: "GOtv Max", price: 8500 },
    { id: "14", bundle_id: 14, name: "GOtv Supa", price: 11400 },
    { id: "15", bundle_id: 15, name: "GOtv Supa Plus", price: 16800 },
  ],
  startimes: [
    { id: "5", bundle_id: 5, name: "Nova (Antenna) - 1 Week", price: 700 },
    { id: "17", bundle_id: 17, name: "Nova (Antenna) - 1 Month", price: 2100 },
    { id: "16", bundle_id: 16, name: "Nova (Dish) - 1 Week", price: 700 },
    { id: "18", bundle_id: 18, name: "Basic (Antenna) - 1 Week", price: 1400 },
    { id: "20", bundle_id: 20, name: "Basic (Antenna) - 1 Month", price: 4000 },
    { id: "19", bundle_id: 19, name: "Basic (Dish) - 1 Week", price: 1700 },
    { id: "21", bundle_id: 21, name: "Basic (Dish) - 1 Month", price: 5100 },
    { id: "22", bundle_id: 22, name: "Classic (Dish) - 1 Week", price: 2500 },
    { id: "23", bundle_id: 23, name: "Classic (Dish) - 1 Month", price: 7400 },
    { id: "25", bundle_id: 25, name: "Super (Antenna) - 1 Week", price: 3200 },
    { id: "26", bundle_id: 26, name: "Super (Antenna) - 1 Month", price: 9500 },
    { id: "24", bundle_id: 24, name: "Super (Dish) - 1 Week", price: 3300 },
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

        await notifyAdminTransactionFailed(
          serviceClient(),
          transaction_id,
          error instanceof Error ? error.message : "Unknown error",
        );

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

        await notifyAdminTransactionFailed(
          serviceClient(),
          transaction_id,
          error instanceof Error ? error.message : "Unknown error",
        );

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

      console.log(`Processing electricity: disco_id=${providerId} amount=${amount} for meter ${meter_number}`);

      try {
        const result = await callVtuApiPost("/electricity/purchase/", {
          disco_id: providerId,
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

        await notifyAdminTransactionFailed(
          serviceClient(),
          transaction_id,
          error instanceof Error ? error.message : "Unknown error",
        );

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

      console.log(`Processing cable TV: plan_id=${bundleId} for ${smartcard_number}`);

      try {
        const result = await callVtuApiPost("/cable/purchase/", {
          plan_id: bundleId,
          cardnumber: smartcard_number,
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

        await notifyAdminTransactionFailed(
          serviceClient(),
          transaction_id,
          error instanceof Error ? error.message : "Unknown error",
        );

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

        await notifyAdminTransactionFailed(
          serviceClient(),
          transaction_id,
          error instanceof Error ? error.message : "Unknown error",
        );

        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Exam PIN purchase failed",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Provider wallet balance (admin only)
    if (body.action === "provider_wallet_balance") {
      const userId = (claimsData.claims as any).sub as string | undefined;
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use service-role client to safely check admin role bypassing RLS
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: isAdminData, error: roleError } = await adminClient.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      if (roleError || !isAdminData) {
        await logAdminActivity({
          actorUserId: userId,
          action: "admin_access_denied",
          details: { action: "provider_wallet_balance" },
        });
        return new Response(
          JSON.stringify({ success: false, error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await logAdminActivity({
        actorUserId: userId,
        action: "admin_access_granted",
        details: { action: "provider_wallet_balance" },
      });

      try {
        const result = await callVtuApiGet("/wallet/balance/");
        const balance = Number(result?.data?.balance ?? result?.balance ?? 0);

        // Low-balance alert: notify all admins via send-notification (30-min cooldown)
        try {
          if (balance < 5000) {
            const cooldownMs = 30 * 60 * 1000;
            const sinceIso = new Date(Date.now() - cooldownMs).toISOString();
            const { data: recent } = await adminClient
              .from("notifications")
              .select("id")
              .eq("type", "admin_low_balance")
              .gte("created_at", sinceIso)
              .limit(1);

            if (!recent || recent.length === 0) {
              const { data: admins } = await adminClient
                .from("user_roles")
                .select("user_id")
                .eq("role", "admin");
              const adminIds = (admins || []).map((a: any) => a.user_id).filter(Boolean);
              if (adminIds.length > 0) {
                await adminClient.functions.invoke("send-notification", {
                  body: {
                    action: "send",
                    user_ids: adminIds,
                    title: "⚠️ Low CheapDataHub balance",
                    body: `Reseller wallet is ₦${balance.toLocaleString()}. Top up to avoid failed transactions.`,
                    type: "admin_low_balance",
                    data: { balance },
                  },
                });
              }
            }
          }
        } catch (notifyErr) {
          console.error("Low-balance notify error:", notifyErr);
        }

        return new Response(
          JSON.stringify({
            success: true,
            balance,
            message: result?.message || "Wallet balance fetched",
            raw: result,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch wallet balance",
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
