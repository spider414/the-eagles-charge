import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

// Verify Paystack webhook signature using Web Crypto API
async function verifySignature(payload: string, signature: string, secretKey: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return computedHash === signature;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      console.error("Paystack secret key not configured");
      return new Response("Configuration error", { status: 500 });
    }

    // Get and verify signature
    const signature = req.headers.get("x-paystack-signature");
    const rawBody = await req.text();

    if (!signature) {
      console.error("Missing Paystack signature");
      return new Response("Missing signature", { status: 400 });
    }

    const isValid = await verifySignature(rawBody, signature, paystackSecretKey);
    if (!isValid) {
      console.error("Invalid Paystack signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);
    console.log("Paystack webhook event:", event.event, event.data?.reference);

    // Create admin client for database operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle dedicated account transfer (DVA credit)
    if (event.event === "dedicatedaccount.assign.success") {
      console.log("DVA assigned successfully:", event.data);
      
      // Find the user by customer_code and update their DVA details
      const customerCode = event.data.customer?.customer_code;
      if (customerCode) {
        const dvaDetails = event.data.dedicated_account;
        
        const { error } = await supabase
          .from("profiles")
          .update({
            dva_account_number: dvaDetails.account_number,
            dva_account_name: dvaDetails.account_name,
            dva_bank_name: dvaDetails.bank?.name || "Wema Bank",
          })
          .eq("paystack_customer_code", customerCode);

        if (error) {
          console.error("Failed to update DVA details:", error);
        } else {
          console.log("DVA details updated for customer:", customerCode);
        }
      }
    }

    // Handle successful charge (bank transfer received)
    if (event.event === "charge.success") {
      const data = event.data;
      const channel = data.channel;
      const reference = data.reference;
      const amount = data.amount / 100; // Convert from kobo to naira
      const customerCode = data.customer?.customer_code;

      console.log("Charge success:", { channel, reference, amount, customerCode });

      // Check if this is a DVA transfer (dedicated_nuban channel)
      if (channel === "dedicated_nuban" && customerCode) {
        console.log("DVA transfer received for customer:", customerCode);

        // Find user by customer code
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, user_id, wallet_balance, email")
          .eq("paystack_customer_code", customerCode)
          .single();

        if (profileError || !profile) {
          console.error("Profile not found for customer:", customerCode, profileError);
          return new Response("OK", { status: 200 });
        }

        // Check if transaction already processed (idempotency)
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("id")
          .eq("paystack_reference", reference)
          .single();

        if (existingTx) {
          console.log("Transaction already processed:", reference);
          return new Response("OK", { status: 200 });
        }

        // Create transaction record
        const { data: transaction, error: txError } = await supabase
          .from("transactions")
          .insert({
            user_id: profile.user_id,
            transaction_type: "wallet_topup",
            status: "completed",
            amount: amount,
            paystack_reference: reference,
            api_response: data,
          })
          .select()
          .single();

        if (txError) {
          console.error("Failed to create transaction:", txError);
          return new Response("OK", { status: 200 });
        }

        // Credit wallet using atomic function to prevent race conditions
        const { data: newBalance, error: walletError } = await supabase.rpc('credit_wallet', {
          p_profile_id: profile.id,
          p_amount: amount
        });

        if (walletError) {
          console.error("Failed to credit wallet:", walletError);
          // Mark transaction as failed for manual review
          await supabase
            .from("transactions")
            .update({ status: "failed", api_response: { ...data, error: "Wallet credit failed" } })
            .eq("id", transaction.id);
        } else {
          console.log(`Wallet atomically credited: ₦${amount} for user ${profile.user_id}. New balance: ₦${newBalance}`);
        }
      }

      // Handle regular card/bank payments (existing transactions)
      if (channel !== "dedicated_nuban" && reference?.startsWith("EAGLE-")) {
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("id, user_id, transaction_type, status")
          .eq("paystack_reference", reference)
          .single();

        if (existingTx && existingTx.status === "pending") {
          // Update transaction to completed
          await supabase
            .from("transactions")
            .update({ status: "completed", api_response: data })
            .eq("id", existingTx.id);

          // If wallet topup, credit the wallet using atomic function
          if (existingTx.transaction_type === "wallet_topup") {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("user_id", existingTx.user_id)
              .single();

            if (profile) {
              const { data: newBalance, error: creditError } = await supabase.rpc('credit_wallet', {
                p_profile_id: profile.id,
                p_amount: amount
              });

              if (!creditError) {
                console.log(`Card payment atomically credited: ₦${amount} for user ${existingTx.user_id}. New balance: ₦${newBalance}`);
              }
            }
          }
        }
      }
    }

    // Handle failed charge
    if (event.event === "charge.failed") {
      const reference = event.data.reference;
      console.log("Charge failed:", reference);

      if (reference) {
        await supabase
          .from("transactions")
          .update({ status: "failed", api_response: event.data })
          .eq("paystack_reference", reference);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
});
