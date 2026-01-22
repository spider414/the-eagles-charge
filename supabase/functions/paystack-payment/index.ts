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
}

interface GetDVARequest {
  action: "get_dva";
}

type RequestBody = InitializeRequest | VerifyRequest | WalletPaymentRequest | BankTransferRequest | CreateDVARequest | GetDVARequest;

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

        // TODO: Here you would integrate with the actual VTU/bills API provider
        // For now, we'll simulate a successful transaction
        // In production, call the real API here and handle response

        // Update transaction to completed
        await supabase
          .from("transactions")
          .update({ 
            status: "completed",
            api_response: { 
              payment_method: "wallet",
              wallet_balance_before: walletBalance,
              wallet_balance_after: newBalance,
              processed_at: new Date().toISOString()
            }
          })
          .eq("id", transaction.id);

        console.log(`Wallet payment completed for transaction ${transaction.id}`);

        return new Response(
          JSON.stringify({
            success: true,
            message: `Payment successful! ₦${amount.toLocaleString()} deducted from wallet.`,
            transaction_id: transaction.id,
            reference: reference,
            new_balance: newBalance,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (processingError) {
        // If processing fails, refund the wallet and mark transaction as failed
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

    // Create Paystack customer (for future use)
    if (body.action === "create_dva") {
      const { email, first_name, last_name, phone } = body;

      // First, create or get customer
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

      // Store customer code in profile for future transactions
      await supabase
        .from("profiles")
        .update({ 
          paystack_customer_code: customerCode,
        })
        .eq("user_id", userId);

      // Note: DVA requires BVN verification in Nigeria
      // For now, we'll use the bank_transfer channel per transaction instead
      return new Response(
        JSON.stringify({
          success: true,
          message: "Customer account created! Use bank transfer option to get account details for each transaction.",
          requires_verification: true,
          customer_code: customerCode,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get bank transfer details for a specific amount
    if (body.action === "get_dva") {
      // Since DVA requires BVN, we return info about using bank_transfer instead
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          message: "Use the bank transfer option when funding to get temporary account details.",
          use_bank_transfer: true,
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
