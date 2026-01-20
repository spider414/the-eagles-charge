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

type RequestBody = InitializeRequest | VerifyRequest;

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

      // If payment successful and first transaction, handle referral bonus
      if (transactionStatus === "completed" && updatedTx) {
        // Check if this is user's first completed transaction
        const { count } = await supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "completed");

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

            // Update referrer's earnings
            const { error: rpcError } = await supabase.rpc("increment_wallet", {
              profile_id: profile.referred_by,
              amount: bonusAmount,
            });
            
            if (rpcError) {
              console.log("RPC not available:", rpcError.message);
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
            ? "Payment successful! Your transaction is being processed."
            : transactionStatus === "failed"
            ? "Payment failed. Please try again."
            : "Payment is being processed.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
