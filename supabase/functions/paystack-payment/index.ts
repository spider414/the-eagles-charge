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

interface ValidateBVNRequest {
  action: "validate_bvn";
  bvn: string;
  account_number: string;
  bank_code: string;
  first_name: string;
  last_name: string;
}

type RequestBody = InitializeRequest | VerifyRequest | WalletPaymentRequest | BankTransferRequest | CreateDVARequest | GetDVARequest | ValidateBVNRequest;

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
      
      // Generate unique reference
      const reference = `EAGLE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          transaction_type: metadata.transaction_type,
          status: "pending",
          amount: amount,
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
          amount: amount * 100, // Paystack uses kobo
          reference,
          callback_url: callbackUrl,
          metadata: {
            ...metadata,
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

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          reference,
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

      // Handle wallet top-up - credit wallet after successful payment
      if (transactionStatus === "completed" && existingTx?.transaction_type === "wallet_topup") {
        const amountToCredit = paystackData.data.amount / 100; // Convert from kobo to naira
        
        // Get current profile to update wallet
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("id, wallet_balance")
          .eq("user_id", userId)
          .single();

        if (userProfile) {
          const newBalance = (userProfile.wallet_balance || 0) + amountToCredit;
          
          const { error: walletError } = await supabase
            .from("profiles")
            .update({ wallet_balance: newBalance })
            .eq("id", userProfile.id);

          if (walletError) {
            console.error("Wallet update error:", walletError);
          } else {
            console.log(`Wallet credited with ₦${amountToCredit}. New balance: ₦${newBalance}`);
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

            // Get referrer profile to update wallet
            const { data: referrerProfile } = await supabase
              .from("profiles")
              .select("id, wallet_balance, total_referral_earnings")
              .eq("id", profile.referred_by)
              .single();

            if (referrerProfile) {
              // Update referrer's wallet and earnings
              await supabase
                .from("profiles")
                .update({
                  wallet_balance: (referrerProfile.wallet_balance || 0) + bonusAmount,
                  total_referral_earnings: (referrerProfile.total_referral_earnings || 0) + bonusAmount,
                })
                .eq("id", referrerProfile.id);
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

      // Get user's profile and check wallet balance
      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, wallet_balance")
        .eq("user_id", userId)
        .single();

      if (profileError || !userProfile) {
        throw new Error("Failed to retrieve user profile");
      }

      const walletBalance = userProfile.wallet_balance || 0;

      if (walletBalance < amount) {
        throw new Error(`Insufficient wallet balance. Available: ₦${walletBalance.toLocaleString()}`);
      }

      // Generate unique reference for wallet payment
      const reference = `WALLET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create transaction record with processing status
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          transaction_type: metadata.transaction_type,
          status: "processing",
          amount: amount,
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
        // Deduct from wallet immediately
        const newBalance = walletBalance - amount;
        const { error: walletError } = await supabase
          .from("profiles")
          .update({ wallet_balance: newBalance })
          .eq("id", userProfile.id);

        if (walletError) {
          throw new Error("Failed to deduct from wallet");
        }

        console.log(`Wallet payment: Deducted ₦${amount} from wallet. New balance: ₦${newBalance}`);

        // Call VTU service for real transaction processing
        let vtuResult: any = null;
        const vtuApiKey = Deno.env.get("CHEAPDATAHUB_API_KEY");
        const vtuBaseUrl = Deno.env.get("VTU_BASE_URL") || "https://vtu.ng/wp-json/api/v2";
        
        if (metadata.transaction_type === "airtime" && metadata.phone_number && metadata.network) {
          const requestId = `AIR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          console.log(`Processing airtime via VTU API: ${metadata.network} ₦${amount} for ${metadata.phone_number}`);
          
          const vtuResponse = await fetch(`${vtuBaseUrl}/airtime`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${vtuApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              request_id: requestId,
              phone: metadata.phone_number,
              service_id: metadata.network.toLowerCase(),
              amount: amount,
            }),
          });
          vtuResult = await vtuResponse.json();
          console.log("VTU Airtime Response:", JSON.stringify(vtuResult));
          
        } else if (metadata.transaction_type === "data" && metadata.phone_number && metadata.network && metadata.data_plan) {
          const requestId = `DATA-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          console.log(`Processing data via VTU API: ${metadata.network} ${metadata.data_plan} for ${metadata.phone_number}`);
          
          const vtuResponse = await fetch(`${vtuBaseUrl}/data`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${vtuApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              request_id: requestId,
              phone: metadata.phone_number,
              service_id: metadata.network.toLowerCase(),
              variation_id: metadata.data_plan,
            }),
          });
          vtuResult = await vtuResponse.json();
          console.log("VTU Data Response:", JSON.stringify(vtuResult));
          
        } else if (metadata.transaction_type === "electricity" && metadata.meter_number && metadata.electricity_provider) {
          const requestId = `ELEC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          console.log(`Processing electricity via VTU API: ${metadata.electricity_provider} ₦${amount} for meter ${metadata.meter_number}`);
          
          const vtuResponse = await fetch(`${vtuBaseUrl}/electricity`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${vtuApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              request_id: requestId,
              meter_number: metadata.meter_number,
              service_id: metadata.electricity_provider.toLowerCase(),
              amount: amount,
              meter_type: metadata.meter_type || "prepaid",
            }),
          });
          vtuResult = await vtuResponse.json();
          console.log("VTU Electricity Response:", JSON.stringify(vtuResult));
          
        } else if (metadata.transaction_type === "cable_tv" && metadata.cable_smartcard && metadata.cable_provider && metadata.cable_plan) {
          const requestId = `TV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          console.log(`Processing cable TV via VTU API: ${metadata.cable_provider} ${metadata.cable_plan} for ${metadata.cable_smartcard}`);
          
          const vtuResponse = await fetch(`${vtuBaseUrl}/tv`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${vtuApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              request_id: requestId,
              smartcard_number: metadata.cable_smartcard,
              service_id: metadata.cable_provider.toLowerCase(),
              variation_id: metadata.cable_plan,
            }),
          });
          vtuResult = await vtuResponse.json();
          console.log("VTU Cable TV Response:", JSON.stringify(vtuResult));
        }

        // Check VTU result and update transaction accordingly
        const isVtuSuccess = vtuResult?.code === "success" || vtuResult?.status === "success";
        const vtuToken = vtuResult?.data?.token || null;
        
        if (vtuResult && !isVtuSuccess) {
          // VTU call failed - refund wallet
          console.error("VTU API failed:", vtuResult);
          throw new Error(vtuResult?.message || vtuResult?.error || "Service delivery failed");
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

        return new Response(
          JSON.stringify({
            success: true,
            message: vtuResult?.message || `Payment successful! ₦${amount.toLocaleString()} deducted from wallet.`,
            transaction_id: transaction.id,
            reference: reference,
            new_balance: newBalance,
            token: vtuToken,
            data: vtuResult?.data,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (processingError) {
        // If processing fails, refund the wallet and mark transaction as failed
        console.error("Processing error, refunding wallet:", processingError);
        
        await supabase
          .from("profiles")
          .update({ wallet_balance: walletBalance }) // Restore original balance
          .eq("id", userProfile.id);

        await supabase
          .from("transactions")
          .update({ 
            status: "failed",
            api_response: { error: processingError instanceof Error ? processingError.message : "Processing failed" }
          })
          .eq("id", transaction.id);

        throw processingError;
      }
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
          phone,
        }),
      });

      const customerData = await customerResponse.json();
      console.log("Paystack customer response:", customerData);

      if (!customerData.status) {
        throw new Error(customerData.message || "Failed to create customer");
      }

      const customerCode = customerData.data.customer_code;
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
          } else {
            throw new Error(validateData.message || "BVN validation failed. Please check your details.");
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

    throw new Error("Invalid action");
  } catch (error) {
    console.error("Paystack payment error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
