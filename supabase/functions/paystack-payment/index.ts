import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaystackMetadata {
  transaction_type: string;
  phone_number?: string;
  network?: string;
  data_plan?: string;
  electricity_provider?: string;
  meter_number?: string;
  meter_type?: string;
  cable_provider?: string;
  cable_smartcard?: string;
  cable_plan?: string;
  internet_plan?: string;
  account_number?: string;
}

interface InitializeRequest {
  action: "initialize";
  amount: number;
  email: string;
  metadata: PaystackMetadata;
}

interface VerifyRequest {
  action: "verify";
  reference: string;
}

interface WalletPaymentRequest {
  action: "wallet_payment";
  amount: number;
  metadata: PaystackMetadata;
}

interface BankTransferRequest {
  action: "bank_transfer";
  amount: number;
  email: string;
}

interface CreateDVARequest {
  action: "create_dva";
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  bvn: string;
}

interface GetDVARequest {
  action: "get_dva";
}

interface ReconcileDVARequest {
  action: "reconcile_dva";
}

interface ValidateBVNRequest {
  action: "validate_bvn";
  bvn: string;
  account_number: string;
  bank_code: string;
  first_name: string;
  last_name: string;
}

type RequestBody = InitializeRequest | VerifyRequest | WalletPaymentRequest | BankTransferRequest | CreateDVARequest | GetDVARequest | ValidateBVNRequest | ReconcileDVARequest;

// CheapDataHub electricity DisCo to disco_id mapping
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

// Platform service fee: 2% on every service EXCEPT airtime (recharge card) and wallet top-ups.
const SERVICE_FEE_RATE = 0.02;
const FEE_EXEMPT_TYPES = new Set(["airtime", "wallet_topup"]);
const computeServiceFee = (transactionType: string, baseAmount: number): number => {
  if (FEE_EXEMPT_TYPES.has(transactionType)) return 0;
  return Math.ceil(baseAmount * SERVICE_FEE_RATE);
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      throw new Error("Paystack secret key not configured");
    }

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

    const userId = claimsData.claims.sub;
    const body: RequestBody = await req.json();

    if (body.action === "initialize") {
      const { amount, email, metadata } = body;

      // Server-authoritative 2% service fee (not applied to airtime / wallet top-ups)
      const serviceFee = computeServiceFee(metadata.transaction_type, amount);
      const chargeAmount = amount + serviceFee;

      // Generate unique reference (strict HARMIC- prefix)
      const reference = `HARMIC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          transaction_type: metadata.transaction_type,
          status: "pending",
          amount: chargeAmount,
          description: serviceFee > 0 ? `Includes ₦${serviceFee.toLocaleString()} service fee (2%)` : null,
          phone_number: metadata.phone_number || null,
          network: metadata.network || null,
          data_plan: metadata.data_plan || null,
          electricity_provider: metadata.electricity_provider || null,
          meter_number: metadata.meter_number || null,
          meter_type: metadata.meter_type || null,
          cable_provider: metadata.cable_provider || null,
          cable_smartcard: metadata.cable_smartcard || null,
          cable_plan: metadata.cable_plan || null,
          paystack_reference: reference,
        })
        .select()
        .single();

      if (txError) {
        console.error("Transaction creation error:", txError);
        throw new Error("Failed to create transaction record");
      }

      // Initialize Paystack payment
      const callbackUrl = `${req.headers.get("origin") || "https://id-preview--01d5208d-dc13-49b3-a8ed-a8a5e2037792.lovable.app"}/payment/callback`;
      
      const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: chargeAmount * 100, // Paystack uses kobo
          reference,
          callback_url: callbackUrl,
          metadata: {
            ...metadata,
            base_amount: amount,
            service_fee: serviceFee,
            transaction_id: transaction.id,
            user_id: userId,
          },
        }),
      });

      const paystackData = await paystackResponse.json();
      console.log("Paystack initialize response:", paystackData);

      if (!paystackData.status) {
        // Update transaction status to failed
        await supabase
          .from("transactions")
          .update({ status: "failed" })
          .eq("id", transaction.id);

        throw new Error(paystackData.message || "Failed to initialize payment");
      }

      // Update transaction with access code
      await supabase
        .from("transactions")
        .update({ paystack_access_code: paystackData.data.access_code })
        .eq("id", transaction.id);

      // Get Paystack public key for inline popup
      const paystackPublicKey = Deno.env.get("PAYSTACK_PUBLIC_KEY");

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          reference,
          amount: chargeAmount,
          service_fee: serviceFee,
          public_key: paystackPublicKey,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "verify") {
      const { reference } = body;

      // Verify payment with Paystack
      const paystackResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
          },
        }
      );

      const paystackData = await paystackResponse.json();
      console.log("Paystack verify response:", paystackData);

      if (!paystackData.status) {
        throw new Error(paystackData.message || "Failed to verify payment");
      }

      const paymentStatus = paystackData.data.status;
      let transactionStatus: string;

      if (paymentStatus === "success") {
        transactionStatus = "completed";
      } else if (paymentStatus === "failed") {
        transactionStatus = "failed";
      } else {
        transactionStatus = "processing";
      }

      // Get transaction to check type
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("*")
        .eq("paystack_reference", reference)
        .single();

      // Update transaction status
      const { data: updatedTx, error: updateError } = await supabase
        .from("transactions")
        .update({
          status: transactionStatus,
          api_response: paystackData.data,
        })
        .eq("paystack_reference", reference)
        .select()
        .single();

      if (updateError) {
        console.error("Transaction update error:", updateError);
      }

      // Send email receipt (best-effort). Use Paystack customer email when it is a real address,
      // otherwise fall back to the profile's saved contact_email.
      if (transactionStatus === "completed") {
        try {
          const paystackEmail: string | undefined = paystackData.data?.customer?.email;
          const isReal = (e?: string) =>
            !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.match(/@(eagles\.local|phone\.harmicglobal\.com)$/);

          let receiptEmail = isReal(paystackEmail) ? paystackEmail! : "";
          let receiptName: string | null = null;

          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, contact_email")
            .eq("user_id", userId)
            .maybeSingle();
          receiptName = prof?.full_name ?? null;
          if (!receiptEmail && isReal(prof?.contact_email)) {
            receiptEmail = prof!.contact_email!;
          }

          if (receiptEmail) {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "receipt",
                to: receiptEmail,
                name: receiptName,
                reference,
                amount: (paystackData.data?.amount || 0) / 100,
                transaction_type: existingTx?.transaction_type || "payment",
                paid_at: paystackData.data?.paid_at || new Date().toISOString(),
                status: "successful",
                payment_method: "Card / Bank",
                network: existingTx?.network,
                phone_number: existingTx?.phone_number,
                plan_name: existingTx?.data_plan || existingTx?.cable_plan || existingTx?.internet_plan,
                meter_number: existingTx?.meter_number,
                meter_type: existingTx?.meter_type,
                cable_provider: existingTx?.cable_provider,
                cable_smartcard: existingTx?.cable_smartcard,
              },
              headers: { Authorization: authHeader },
            });
          }
        } catch (mailErr) {
          console.warn("Receipt email failed:", mailErr);
        }
      }

      // Handle wallet top-up - credit wallet after successful payment using atomic function
      if (transactionStatus === "completed" && existingTx?.transaction_type === "wallet_topup") {
        const amountToCredit = paystackData.data.amount / 100; // Convert from kobo to naira
        
        // Get current profile to get ID for credit function
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (userProfile) {
          // Use atomic credit function to prevent race conditions
          const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );

          const { data: newBalance, error: creditError } = await supabaseAdmin.rpc('credit_wallet', {
            p_profile_id: userProfile.id,
            p_amount: amountToCredit
          });

          if (creditError) {
            console.error("Wallet credit error:", creditError);
          } else {
            console.log(`Wallet atomically credited with ₦${amountToCredit}. New balance: ₦${newBalance}`);
          }
        }
      }

      // If payment successful and first transaction, handle referral bonus
      if (transactionStatus === "completed" && updatedTx && existingTx?.transaction_type !== "wallet_topup") {
        // Check if this is user's first completed transaction (excluding wallet top-ups)
        const { count } = await supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed")
          .neq("transaction_type", "wallet_topup");

        if (count === 1) {
          // First completed transaction - award referral bonus
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, referred_by")
            .eq("user_id", userId)
            .single();

          if (profile?.referred_by) {
            // Award ₦100 to both referrer and referee
            const bonusAmount = 100;

            // Use atomic credit function for referrer bonus to prevent race conditions
            const supabaseAdminRef = createClient(
              Deno.env.get("SUPABASE_URL")!,
              Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
            );

            // Atomically credit referrer wallet
            const { error: refCreditError } = await supabaseAdminRef.rpc('credit_wallet', {
              p_profile_id: profile.referred_by,
              p_amount: bonusAmount
            });

            if (!refCreditError) {
              // Update total referral earnings - fetch current and update
              const { data: referrerData } = await supabaseAdminRef
                .from("profiles")
                .select("total_referral_earnings")
                .eq("id", profile.referred_by)
                .single();

              if (referrerData) {
                await supabaseAdminRef
                  .from("profiles")
                  .update({
                    total_referral_earnings: (referrerData.total_referral_earnings || 0) + bonusAmount
                  })
                  .eq("id", profile.referred_by);
              }
            }

            // Record the referral reward
            await supabase.from("referral_rewards").insert({
              referrer_id: profile.referred_by,
              referred_id: profile.id,
              reward_amount: bonusAmount,
              transaction_id: updatedTx.id,
            });

            console.log("Referral bonus awarded successfully");
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: transactionStatus === "completed",
          status: transactionStatus,
          message: transactionStatus === "completed" 
            ? existingTx?.transaction_type === "wallet_topup"
              ? "Wallet funded successfully!"
              : "Payment successful! Your transaction is being processed."
            : transactionStatus === "failed"
            ? "Payment failed. Please try again."
            : "Payment is being processed.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "wallet_payment") {
      const { amount, metadata } = body;

      // Server-authoritative 2% service fee (not applied to airtime / wallet top-ups).
      // `amount` stays the base value sent to the VTU provider; `chargeAmount` is what the user pays.
      const serviceFee = computeServiceFee(metadata.transaction_type, amount);
      const chargeAmount = amount + serviceFee;

      // Get user's profile ID first
      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, wallet_balance")
        .eq("user_id", userId)
        .single();

      if (profileError || !userProfile) {
        throw new Error("Failed to retrieve user profile");
      }

      const walletBalance = userProfile.wallet_balance || 0;

      // Generate unique reference for wallet payment
      const reference = `WALLET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create transaction record with processing status
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          transaction_type: metadata.transaction_type,
          status: "processing",
          amount: chargeAmount,
          description: serviceFee > 0 ? `Includes ₦${serviceFee.toLocaleString()} service fee (2%)` : null,
          phone_number: metadata.phone_number || null,
          network: metadata.network || null,
          data_plan: metadata.data_plan || null,
          electricity_provider: metadata.electricity_provider || null,
          meter_number: metadata.meter_number || null,
          meter_type: metadata.meter_type || null,
          cable_provider: metadata.cable_provider || null,
          cable_smartcard: metadata.cable_smartcard || null,
          cable_plan: metadata.cable_plan || null,
          paystack_reference: reference,
        })
        .select()
        .single();

      if (txError) {
        console.error("Transaction creation error:", txError);
        throw new Error("Failed to create transaction record");
      }

      try {
        // Use atomic debit function to prevent race conditions
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: debitResult, error: debitError } = await supabaseAdmin.rpc('debit_wallet', {
          p_profile_id: userProfile.id,
          p_amount: chargeAmount
        });

        if (debitError) {
          console.error("Wallet debit error:", debitError);
          throw new Error("Failed to deduct from wallet");
        }

        // Check if debit was successful (returns array with {success, new_balance})
        const debitRow = Array.isArray(debitResult) ? debitResult[0] : debitResult;
        if (!debitRow || !debitRow.success) {
          throw new Error(`Insufficient wallet balance. Available: ₦${walletBalance.toLocaleString()}`);
        }

        const newBalance = debitRow.new_balance;
        console.log(`Wallet payment: Atomically deducted ₦${chargeAmount} (base ₦${amount} + fee ₦${serviceFee}). New balance: ₦${newBalance}`);

        // Call VTU service for real transaction processing
        let vtuResult: any = null;
        // Use CheapDataHub 2 API key
        const vtuApiKey = (Deno.env.get("CHEAPDATAHUB2_API_KEY") || Deno.env.get("CHEAPDATAHUB_API_KEY") || "").trim();
        // NOTE: non-www SSL cert is expired; keep www.
        const vtuBaseUrl = "https://www.cheapdatahub.ng/api/v1/resellers";

        console.log(`VTU API Key exists: ${!!vtuApiKey}`);
        console.log(`VTU API Key length: ${vtuApiKey.length}`);

        if (!vtuApiKey) {
          throw new Error("VTU API key not configured. Please set CHEAPDATAHUB2_API_KEY.");
        }

        const cheapDataHubPost = async (path: string, payload: Record<string, unknown>) => {
          const url = `${vtuBaseUrl}${path}`;

          const doFetch = async (u: string) =>
            await fetch(u, {
              method: "POST",
              redirect: "manual",
              headers: {
                // CheapDataHub auth scheme can differ by account; try Bearer (Token was not being recognized).
                Authorization: `Bearer ${vtuApiKey}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(payload),
            });

          let res = await doFetch(url);

          // Follow a single redirect manually (Authorization can be dropped on auto-follow)
          if ([301, 302, 307, 308].includes(res.status)) {
            const location = res.headers.get("location");
            if (location) {
              const redirectedUrl = new URL(location, url).toString();
              console.log(`CheapDataHub redirect: ${url} -> ${redirectedUrl}`);
              res = await doFetch(redirectedUrl);
            }
          }

          const text = await res.text();
          console.log(`CheapDataHub HTTP ${res.status} for ${path}: ${text.substring(0, 300)}`);

          try {
            return JSON.parse(text);
          } catch {
            return { status: "error", error: "Non-JSON response", raw: text };
          }
        };

        const providerIdByNetwork: Record<string, number> = {
          mtn: 1,
          glo: 2,
          airtel: 3,
          "9mobile": 4,
        };
        
        if (metadata.transaction_type === "airtime" && metadata.phone_number && metadata.network) {
          console.log(`Processing airtime via CheapDataHub: ${metadata.network} ₦${amount} for ${metadata.phone_number}`);

          const providerId = providerIdByNetwork[String(metadata.network).toLowerCase()];
          if (!providerId) {
            throw new Error(`Unsupported network provider: ${metadata.network}`);
          }
          
          vtuResult = await cheapDataHubPost("/airtime/purchase/", {
            // CheapDataHub reseller API expects a numeric provider_id for airtime/data.
            // (MTN: 1, Glo: 2, Airtel: 3, 9mobile: 4)
            provider_id: providerId,
            phone_number: metadata.phone_number,
            amount,

            // Keep legacy keys too (some accounts/docs reference these)
            mobile_number: metadata.phone_number,
            network: metadata.network.toUpperCase(),
            airtime_type: "VTU",
          });
          console.log("CheapDataHub Airtime Response:", JSON.stringify(vtuResult));
          
        } else if (metadata.transaction_type === "data" && metadata.phone_number && metadata.network && metadata.data_plan) {
          // CheapDataHub expects numeric provider_id + bundle_id for data purchases.
          const providerId = providerIdByNetwork[String(metadata.network).toLowerCase()];
          if (!providerId) {
            throw new Error(`Unsupported network provider: ${metadata.network}`);
          }

          console.log(
            `Processing data via CheapDataHub: provider_id=${providerId} bundle_id=${metadata.data_plan} for ${metadata.phone_number}`,
          );

          // Primary (documented) payload
          vtuResult = await cheapDataHubPost("/data/purchase/", {
            provider_id: providerId,
            bundle_id: metadata.data_plan,
            phone_number: metadata.phone_number,
          });
          console.log("CheapDataHub Data Response:", JSON.stringify(vtuResult));

          // Some CheapDataHub accounts accept alternative keys. Retry once if we get the known bundle error.
          const msg = (vtuResult?.message || vtuResult?.error || "").toString().toLowerCase();
          if (msg.includes("bundle") && msg.includes("does not exist")) {
            console.log("Retrying data purchase with alternative payload keys (mobile_number/network/plan)...");
            vtuResult = await cheapDataHubPost("/data/purchase/", {
              provider_id: providerId,
              bundle_id: metadata.data_plan,
              mobile_number: metadata.phone_number,
              network: String(metadata.network).toUpperCase(),
            });
            console.log("CheapDataHub Data Response (retry):", JSON.stringify(vtuResult));
          }
          
        } else if (metadata.transaction_type === "electricity" && metadata.meter_number && metadata.electricity_provider) {
          const providerId = ELECTRICITY_PROVIDER_IDS[metadata.electricity_provider.toLowerCase()];
          if (!providerId) {
            throw new Error(`Unsupported electricity provider: ${metadata.electricity_provider}`);
          }
          console.log(`Processing electricity via CheapDataHub: disco_id=${providerId} ₦${amount} for meter ${metadata.meter_number}`);
          
          vtuResult = await cheapDataHubPost("/electricity/purchase/", {
            disco_id: providerId,
            meter_number: metadata.meter_number,
            amount: amount,
            meter_type: (metadata.meter_type || "prepaid").toLowerCase(),
          });
          console.log("CheapDataHub Electricity Response:", JSON.stringify(vtuResult));
          
        } else if (metadata.transaction_type === "cable_tv" && metadata.cable_smartcard && metadata.cable_provider && metadata.cable_plan) {
          const planId = parseInt(metadata.cable_plan, 10);
          if (isNaN(planId)) {
            throw new Error(`Invalid cable plan ID: ${metadata.cable_plan}`);
          }
          console.log(`Processing cable TV via CheapDataHub: plan_id=${planId} for ${metadata.cable_smartcard}`);
          
          vtuResult = await cheapDataHubPost("/cable/purchase/", {
            plan_id: planId,
            cardnumber: metadata.cable_smartcard,
          });
          console.log("CheapDataHub Cable TV Response:", JSON.stringify(vtuResult));

        } else if (metadata.transaction_type === "exam_pin" && metadata.exam_product_id) {
          const qty = metadata.exam_quantity || 1;
          console.log(`Processing exam PIN via CheapDataHub: product_id=${metadata.exam_product_id} quantity=${qty}`);
          
          vtuResult = await cheapDataHubPost("/exam-pin/purchase/", {
            product_id: metadata.exam_product_id,
            quantity: qty,
          });
          console.log("CheapDataHub Exam PIN Response:", JSON.stringify(vtuResult));
        }

        // Check VTU result and update transaction accordingly
        // CheapDataHub can return variants like:
        //  - { status: "true", message: "Airtime Purchase Successful", details: { Status: "successful", ... } }
        //  - { Status: "successful", ... }
        const detailsStatusRaw = vtuResult?.details?.Status ?? vtuResult?.details?.status;
        const detailsStatus = detailsStatusRaw ? String(detailsStatusRaw).toLowerCase() : null;
        const topStatusRaw = vtuResult?.Status ?? vtuResult?.status;
        const topStatus = topStatusRaw ? String(topStatusRaw).toLowerCase() : "";

        const isVtuSuccess = detailsStatus
          ? detailsStatus === "successful"
          : topStatus === "successful" ||
            topStatus === "success" ||
            topStatus === "true" ||
            vtuResult?.code === "success" ||
            vtuResult?.success === true;

        const vtuToken = vtuResult?.token || vtuResult?.data?.token || vtuResult?.details?.token || null;
        
        if (vtuResult && !isVtuSuccess) {
          // VTU call failed - refund wallet
          console.error("CheapDataHub API failed:", vtuResult);
          
          // Check if it's a server error (HTML response or 500 error)
          if (vtuResult?.raw?.includes("<!doctype") || vtuResult?.raw?.includes("Server Error")) {
            throw new Error("VTU provider is temporarily unavailable. Please try again in a few minutes.");
          }
          
          // Check for specific error messages
          const errorMsg = vtuResult?.detail || vtuResult?.message || vtuResult?.error || vtuResult?.Status;
          if (errorMsg === "Authentication credentials were not provided." || errorMsg === "Invalid API token.") {
            throw new Error("VTU service configuration error. Please contact support.");
          }
          
          throw new Error(errorMsg || "Service delivery failed. Please try again.");
        }

        // Update transaction to completed with VTU response
        await supabase
          .from("transactions")
          .update({ 
            status: "completed",
            token: vtuToken,
            api_response: { 
              payment_method: "wallet",
              wallet_balance_before: walletBalance,
              wallet_balance_after: newBalance,
              vtu_response: vtuResult,
              processed_at: new Date().toISOString()
            }
          })
          .eq("id", transaction.id);

        console.log(`Wallet payment completed for transaction ${transaction.id}`);

        // Best-effort receipt email for wallet payments
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, contact_email, email")
            .eq("user_id", userId)
            .maybeSingle();
          const isReal = (e?: string | null) =>
            !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.match(/@(eagles\.local|phone\.harmicglobal\.com)$/);
          const receiptEmail = isReal(prof?.contact_email)
            ? prof!.contact_email!
            : isReal(prof?.email)
              ? prof!.email!
              : "";
          if (receiptEmail) {
            await supabase.functions.invoke("send-email", {
              body: {
                type: "receipt",
                to: receiptEmail,
                name: prof?.full_name ?? null,
                reference,
                amount: chargeAmount,
                transaction_type: metadata.transaction_type,
                paid_at: new Date().toISOString(),
                status: "successful",
                payment_method: "Wallet",
                network: metadata.network,
                phone_number: metadata.phone_number,
                plan_name: metadata.data_plan || metadata.cable_plan || metadata.internet_plan,
                meter_number: metadata.meter_number,
                meter_type: metadata.meter_type,
                token: vtuToken,
                cable_provider: metadata.cable_provider,
                cable_smartcard: metadata.cable_smartcard,
                new_balance: newBalance,
              },
              headers: { Authorization: authHeader },
            });
          }
        } catch (mailErr) {
          console.warn("Wallet receipt email failed:", mailErr);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: vtuResult?.message || vtuResult?.details?.api_response || `Payment successful! ₦${chargeAmount.toLocaleString()} deducted from wallet.`,
            transaction_id: transaction.id,
            reference: reference,
            service_fee: serviceFee,
            new_balance: newBalance,
            balance_before: walletBalance,
            balance_after: newBalance,
            token: vtuToken,
            data: vtuResult?.data ?? vtuResult?.details,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (processingError) {
        // If processing fails, refund the wallet using atomic credit and mark transaction as refunded
        console.error("Processing error, refunding wallet:", processingError);
        
        // Refund atomically using credit function
        const supabaseAdminRefund = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        
        const { data: refundedBalance, error: refundError } = await supabaseAdminRefund.rpc('credit_wallet', {
          p_profile_id: userProfile.id,
          p_amount: chargeAmount
        });

        if (refundError) {
          console.error("Failed to refund wallet:", refundError);
        } else {
          console.log(`Wallet atomically refunded: ₦${chargeAmount}. Balance restored to: ₦${refundedBalance}`);
        }

        await supabase
          .from("transactions")
          .update({ 
            status: "refunded",
            api_response: {
              payment_method: "wallet",
              refunded: true,
              error: processingError instanceof Error ? processingError.message : "Processing failed",
            }
          })
          .eq("id", transaction.id);

         // IMPORTANT: don't throw here. Returning a 2xx with success:false allows the web client
         // to show the real error message instead of "Edge Function returned a non-2xx".
         return new Response(
           JSON.stringify({
             success: false,
             error: processingError instanceof Error ? processingError.message : "Processing failed",
             refunded: true,
             transaction_id: transaction.id,
             reference,
             new_balance: walletBalance,
           }),
           { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
      }
    }

    if (body.action === "credit_wallet") {
      const { amount } = body as { action: string; amount: number };

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!userProfile) throw new Error("Profile not found");

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: newBalance, error: creditError } = await supabaseAdmin.rpc("credit_wallet", {
        p_profile_id: userProfile.id,
        p_amount: amount,
      });

      if (creditError) throw creditError;

      return new Response(
        JSON.stringify({ success: true, new_balance: newBalance }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "bank_transfer") {
      const { amount, email } = body;
      
      // Generate unique reference
      const reference = `BANK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create a pending transaction record
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          transaction_type: "wallet_topup",
          status: "pending",
          amount: amount,
          paystack_reference: reference,
        })
        .select()
        .single();

      if (txError) {
        console.error("Transaction creation error:", txError);
        throw new Error("Failed to create transaction record");
      }

      // Initialize Paystack payment with bank transfer channel only
      const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amount * 100, // Paystack uses kobo
          reference,
          channels: ["bank_transfer"], // Only bank transfer
          metadata: {
            transaction_type: "wallet_topup",
            transaction_id: transaction.id,
            user_id: userId,
          },
        }),
      });

      const paystackData = await paystackResponse.json();
      console.log("Paystack bank transfer response:", paystackData);

      if (!paystackData.status) {
        await supabase
          .from("transactions")
          .update({ status: "failed" })
          .eq("id", transaction.id);

        throw new Error(paystackData.message || "Failed to initialize bank transfer");
      }

      // Update transaction with access code
      await supabase
        .from("transactions")
        .update({ paystack_access_code: paystackData.data.access_code })
        .eq("id", transaction.id);

      return new Response(
        JSON.stringify({
          success: true,
          reference,
          access_code: paystackData.data.access_code,
          authorization_url: paystackData.data.authorization_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Dedicated Virtual Account with BVN verification
    if (body.action === "create_dva") {
      const { email, first_name, last_name, phone, bvn } = body;

      // Validate required fields
      if (!email || !first_name || !last_name || !bvn) {
        throw new Error("Missing required fields: email, first_name, last_name, and bvn are required");
      }

      if (!/^\d{11}$/.test(String(bvn))) {
        throw new Error("BVN must be exactly 11 digits");
      }

      // Format phone number for Paystack (Nigerian format with country code)
      let formattedPhone = phone?.replace(/\D/g, "") || "";
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "+234" + formattedPhone.substring(1);
      } else if (formattedPhone.startsWith("234")) {
        formattedPhone = "+" + formattedPhone;
      } else if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+234" + formattedPhone;
      }

      if (!/^\+234\d{10}$/.test(formattedPhone)) {
        throw new Error("Please enter a valid Nigerian phone number (e.g. 08012345678)");
      }

      // Step 0: Make sure the BVN actually belongs to the name + phone provided.
      // Paystack's BVN resolution returns the record on file; if it is not
      // enabled on the integration we fall back to Paystack's identification
      // step below, which also validates the names against the BVN.
      const norm = (v: unknown) =>
        String(v ?? "")
          .toLowerCase()
          .replace(/[^a-z]/g, "");
      const lastTen = (v: unknown) => String(v ?? "").replace(/\D/g, "").slice(-10);

      try {
        const bvnLookup = await fetch(`https://api.paystack.co/bank/resolve_bvn/${bvn}`, {
          headers: { Authorization: `Bearer ${paystackSecretKey}` },
        });
        const bvnData = await bvnLookup.json();
        console.log("BVN resolve response:", JSON.stringify(bvnData).slice(0, 400));

        if (bvnData?.status && bvnData?.data) {
          const record = bvnData.data;
          const recordNames = [record.first_name, record.middle_name, record.last_name].map(norm).filter(Boolean);

          const firstOk = recordNames.includes(norm(first_name));
          const lastOk = recordNames.includes(norm(last_name));
          if (!firstOk || !lastOk) {
            throw new Error(
              "The names you entered do not match the BVN record. Please enter your names exactly as registered on your BVN.",
            );
          }

          const recordPhone = lastTen(record.mobile ?? record.phone_number);
          if (recordPhone && lastTen(formattedPhone) !== recordPhone) {
            throw new Error(
              "The phone number you entered is not the one linked to this BVN. Please use your BVN-registered phone number.",
            );
          }
        }
      } catch (bvnErr) {
        const msg = bvnErr instanceof Error ? bvnErr.message : "";
        // Only surface our own mismatch messages; network/plan issues fall through.
        if (msg.includes("do not match the BVN") || msg.includes("linked to this BVN")) {
          throw bvnErr;
        }
        console.warn("BVN pre-check skipped:", msg);
      }

      console.log("Creating DVA with phone:", formattedPhone, "email:", email);

      // Step 1: Create or get customer
      const customerResponse = await fetch("https://api.paystack.co/customer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          first_name,
          last_name,
          phone: formattedPhone,
        }),
      });

      const customerData = await customerResponse.json();
      console.log("Paystack customer response:", customerData);

      if (!customerData.status) {
        throw new Error(customerData.message || "Failed to create customer");
      }

      const customerCode = customerData.data.customer_code;
      
      // Step 1b: If the existing customer has no phone, UPDATE it with the phone number
      // This is critical for DVA creation which requires phone
      if (!customerData.data.phone && formattedPhone) {
        console.log("Customer has no phone, updating with:", formattedPhone);
        
        const updateCustomerResponse = await fetch(`https://api.paystack.co/customer/${customerCode}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: formattedPhone,
            first_name,
            last_name,
          }),
        });
        
        const updateData = await updateCustomerResponse.json();
        console.log("Customer update response:", updateData);
        
        if (!updateData.status) {
          console.warn("Failed to update customer phone:", updateData.message);
          // Continue anyway - DVA creation might still work or give a clearer error
        }
      }

      const isAlreadyIdentified = customerData.data.identified === true;

      // Step 2: Validate customer with BVN (skip if already identified)
      if (!isAlreadyIdentified) {
        const validateResponse = await fetch(`https://api.paystack.co/customer/${customerCode}/identification`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            country: "NG",
            type: "bvn",
            value: bvn,
            first_name,
            last_name,
          }),
        });

        const validateData = await validateResponse.json();
        console.log("Paystack BVN validation response:", validateData);

        // Check if validation failed
        if (!validateData.status) {
          const errorMsg = validateData.message?.toLowerCase() || "";
          const originalMsg = validateData.message || "";
          
          // "Customer already identified" is okay - proceed to DVA
          if (errorMsg.includes("already identified")) {
            console.log("Customer already identified, proceeding to DVA creation");
          } else if (errorMsg.includes("in progress") || errorMsg.includes("processing")) {
            // Store customer code, verification is pending
            await supabase
              .from("profiles")
              .update({ paystack_customer_code: customerCode })
              .eq("user_id", userId);

            return new Response(
              JSON.stringify({
                success: true,
                pending: true,
                message: "BVN verification is being processed. Your virtual account will be ready shortly.",
                customer_code: customerCode,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          } else if (errorMsg.includes("not available on this integration") || errorMsg.includes("bvn") && errorMsg.includes("not")) {
            // BVN validation not enabled on Paystack account - try to create DVA anyway
            console.log("BVN validation not available, attempting DVA creation without validation");
            // Continue to DVA creation step - some accounts allow this
          } else {
            throw new Error(originalMsg || "BVN validation failed. Please check your details.");
          }
        }
      } else {
        console.log("Customer already identified via previous verification, skipping BVN step");
      }

      // Step 3: Create dedicated virtual account
      const dvaResponse = await fetch("https://api.paystack.co/dedicated_account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: customerCode,
          preferred_bank: "wema-bank",
        }),
      });

      const dvaData = await dvaResponse.json();
      console.log("Paystack DVA response:", dvaData);

      if (!dvaData.status) {
        // If DVA creation fails, it might be pending verification
        if (dvaData.message?.includes("pending") || dvaData.message?.includes("processing")) {
          // Store customer code, verification is pending
          await supabase
            .from("profiles")
            .update({ 
              paystack_customer_code: customerCode,
            })
            .eq("user_id", userId);

          return new Response(
            JSON.stringify({
              success: true,
              pending: true,
              message: "BVN verification is being processed. Your virtual account will be ready shortly.",
              customer_code: customerCode,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(dvaData.message || "Failed to create virtual account");
      }

      // Store DVA details in profile
      const dvaDetails = {
        account_number: dvaData.data.account_number,
        account_name: dvaData.data.account_name,
        bank_name: dvaData.data.bank?.name || "Wema Bank",
        customer_code: customerCode,
        dva_id: dvaData.data.id,
      };

      await supabase
        .from("profiles")
        .update({ 
          paystack_customer_code: customerCode,
          dva_account_number: dvaDetails.account_number,
          dva_account_name: dvaDetails.account_name,
          dva_bank_name: dvaDetails.bank_name,
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Virtual account created successfully!",
          data: dvaDetails,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's Dedicated Virtual Account
    if (body.action === "get_dva") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("paystack_customer_code, dva_account_number, dva_account_name, dva_bank_name")
        .eq("user_id", userId)
        .single();

      if (profile?.dva_account_number) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              account_number: profile.dva_account_number,
              account_name: profile.dva_account_name,
              bank_name: profile.dva_bank_name,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if customer exists but no DVA yet (pending verification)
      if (profile?.paystack_customer_code) {
        // Try to fetch DVA from Paystack
        const dvaListResponse = await fetch(
          `https://api.paystack.co/dedicated_account?customer=${profile.paystack_customer_code}`,
          {
            headers: {
              Authorization: `Bearer ${paystackSecretKey}`,
            },
          }
        );

        const dvaListData = await dvaListResponse.json();
        console.log("Paystack DVA list response:", dvaListData);

        if (dvaListData.status && dvaListData.data?.length > 0) {
          const dva = dvaListData.data[0];
          
          // Update profile with DVA details
          await supabase
            .from("profiles")
            .update({ 
              dva_account_number: dva.account_number,
              dva_account_name: dva.account_name,
              dva_bank_name: dva.bank?.name || "Wema Bank",
            })
            .eq("user_id", userId);

          return new Response(
            JSON.stringify({
              success: true,
              data: {
                account_number: dva.account_number,
                account_name: dva.account_name,
                bank_name: dva.bank?.name || "Wema Bank",
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            pending: true,
            message: "Your virtual account is being processed. Please check back shortly.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          message: "No virtual account found. Please create one with your BVN.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reconcile bank transfers made to the user's dedicated virtual account.
    // Covers cases where the Paystack webhook was missed or delayed.
    if (body.action === "reconcile_dva") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, paystack_customer_code, created_at")
        .eq("user_id", userId)
        .single();

      if (!profile?.paystack_customer_code) {
        return new Response(
          JSON.stringify({ success: true, credited: 0, message: "No virtual account found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Resolve numeric Paystack customer id
      const customerRes = await fetch(
        `https://api.paystack.co/customer/${profile.paystack_customer_code}`,
        { headers: { Authorization: `Bearer ${paystackSecretKey}` } }
      );
      const customerData = await customerRes.json();
      const customerId = customerData?.data?.id;

      if (!customerId) {
        return new Response(
          JSON.stringify({ success: true, credited: 0, message: "Customer not found on Paystack" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const txnRes = await fetch(
        `https://api.paystack.co/transaction?customer=${customerId}&status=success&perPage=50`,
        { headers: { Authorization: `Bearer ${paystackSecretKey}` } }
      );
      const txnData = await txnRes.json();
      // Only reconcile transfers that happened after this account was created.
      // Older Paystack history (e.g. from a previous platform/backend) must
      // never be credited again.
      const cutoff = new Date(profile.created_at as string).getTime();
      const transfers = (txnData?.data ?? []).filter(
        (t: { channel?: string; amount?: number; paid_at?: string; created_at?: string }) => {
          if (t.channel !== "dedicated_nuban" || (t.amount ?? 0) <= 0) return false;
          const paidAt = new Date(t.paid_at ?? t.created_at ?? 0).getTime();
          return Number.isFinite(paidAt) && paidAt >= cutoff;
        }
      );

      let credited = 0;
      let totalAmount = 0;

      for (const t of transfers) {
        const reference = String(t.reference);
        const amount = Number(t.amount) / 100;

        const { data: existing } = await supabaseAdmin
          .from("transactions")
          .select("id")
          .eq("paystack_reference", reference)
          .maybeSingle();

        if (existing) continue;

        const { error: creditError } = await supabaseAdmin.rpc("credit_wallet", {
          p_profile_id: profile.id,
          p_amount: amount,
        });

        if (creditError) {
          console.error("Reconcile credit failed:", reference, creditError);
          continue;
        }

        await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          transaction_type: "wallet_topup",
          status: "completed",
          amount,
          paystack_reference: reference,
          description: "Bank transfer to virtual account",
        });

        credited += 1;
        totalAmount += amount;
      }

      return new Response(
        JSON.stringify({ success: true, credited, amount: totalAmount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    const message = error instanceof Error ? error.message : "An error occurred";

    // Keep auth failures as non-2xx, but return 2xx for business/process errors so the
    // frontend can reliably read the JSON payload.
    const status = message === "Unauthorized" || message === "Invalid token" ? 401 : 200;

    console.error("Paystack payment error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
