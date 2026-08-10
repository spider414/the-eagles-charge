import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cleanup edge function for deleting scheduled accounts.
 * 
 * SECURITY: This function requires service-role authentication.
 * It should only be called by cron jobs or admin processes with the service role key.
 * Regular user requests will be rejected with 403 Forbidden.
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Verify service-role authentication
    // This function should only be called by cron jobs or admin processes
    const authHeader = req.headers.get("Authorization");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    
    // Extract token from Authorization header
    const token = authHeader?.replace("Bearer ", "") || "";
    
    // Reject if using anon key or no auth
    if (!authHeader || token === supabaseAnonKey) {
      console.warn("Unauthorized cleanup attempt - missing or anon key used");
      return new Response(
        JSON.stringify({ error: "Forbidden - service role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Only allow service role key
    if (token !== supabaseServiceRoleKey) {
      console.warn("Unauthorized cleanup attempt - invalid service role key");
      return new Response(
        JSON.stringify({ error: "Forbidden - service role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const now = new Date().toISOString();

    const SYNTHETIC = /@(eagles\.local|phone\.harmicglobal\.com)$/i;
    const isRealEmail = (e?: string | null) =>
      !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !SYNTHETIC.test(e);

    const { data: settingsRow } = await supabaseAdmin
      .from("email_settings")
      .select("support_email, brand_name")
      .limit(1)
      .maybeSingle();
    const supportEmail = settingsRow?.support_email || "harmicrecharge@harmicglobal.com";
    const brandName = settingsRow?.brand_name || "HARMIC RECHARGE";

    const notifyByEmail = async (to: string, name: string | null) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceRoleKey}` },
          body: JSON.stringify({ type: "account_deleted", to, name, deleted_at: new Date().toISOString() }),
        });
        if (!res.ok) console.error("Deletion email failed", res.status, await res.text());
      } catch (e) {
        console.error("Deletion email error", e);
      }
    };

    const notifyBySms = async (phone: string) => {
      const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const from = Deno.env.get("TWILIO_PHONE_NUMBER");
      if (!sid || !authToken || !from) return;
      let to = phone.trim().replace(/\s+/g, "");
      if (to.startsWith("0")) to = "+234" + to.slice(1);
      else if (!to.startsWith("+")) to = "+" + to;
      try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${sid}:${authToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: to,
            From: from,
            Body: `${brandName}: Your account and all its data have been permanently deleted as requested. This cannot be reversed. If you did not request this, contact ${supportEmail}.`,
          }),
        });
        if (!res.ok) console.error("Deletion SMS failed", res.status, await res.text());
      } catch (e) {
        console.error("Deletion SMS error", e);
      }
    };

    // Find all profiles scheduled for deletion where the deletion date has passed
    const { data: profilesToDelete, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, email, contact_email, full_name, phone_number")
      .not("deletion_scheduled_at", "is", null)
      .lte("deletion_scheduled_at", now);

    if (fetchError) {
      console.error("Error fetching profiles to delete:", fetchError);
      throw fetchError;
    }

    if (!profilesToDelete || profilesToDelete.length === 0) {
      console.log("No accounts scheduled for deletion at this time.");
      return new Response(
        JSON.stringify({ message: "No accounts to delete", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${profilesToDelete.length} accounts scheduled for deletion.`);

    const deletedAccounts: string[] = [];
    const errors: Array<{ userId: string; error: string }> = [];

    for (const profile of profilesToDelete) {
      try {
        console.log(`Processing deletion for user: ${profile.user_id}`);

        // Notify the user BEFORE their records are removed
        const notifyEmail = isRealEmail(profile.contact_email)
          ? profile.contact_email
          : isRealEmail(profile.email)
            ? profile.email
            : null;
        if (notifyEmail) await notifyByEmail(notifyEmail, profile.full_name ?? null);
        if (profile.phone_number) await notifyBySms(profile.phone_number);

        // Delete related data first (respecting foreign key constraints)
        
        // 1. Delete favorite numbers
        const { error: favError } = await supabaseAdmin
          .from("favorite_numbers")
          .delete()
          .eq("user_id", profile.user_id);
        
        if (favError) {
          console.error(`Error deleting favorite numbers for ${profile.user_id}:`, favError);
        }

        // 2. Delete transactions
        const { error: txError } = await supabaseAdmin
          .from("transactions")
          .delete()
          .eq("user_id", profile.user_id);
        
        if (txError) {
          console.error(`Error deleting transactions for ${profile.user_id}:`, txError);
        }

        // 3. Delete referral rewards (where user is referrer or referred)
        const { error: refError } = await supabaseAdmin
          .from("referral_rewards")
          .delete()
          .or(`referrer_id.eq.${profile.id},referred_id.eq.${profile.id}`);
        
        if (refError) {
          console.error(`Error deleting referral rewards for ${profile.user_id}:`, refError);
        }

        // 3b. Delete notifications & push subscriptions
        const { error: notifError } = await supabaseAdmin
          .from("notifications")
          .delete()
          .eq("user_id", profile.user_id);
        if (notifError) console.error(`Error deleting notifications for ${profile.user_id}:`, notifError);

        const { error: pushError } = await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("user_id", profile.user_id);
        if (pushError) console.error(`Error deleting push subscriptions for ${profile.user_id}:`, pushError);

        // 3c. Detach referral links so the profile row can be removed
        const { error: refLinkError } = await supabaseAdmin
          .from("profiles")
          .update({ referred_by: null })
          .eq("referred_by", profile.id);
        if (refLinkError) console.error(`Error detaching referrals for ${profile.user_id}:`, refLinkError);

        // 4. Delete profile
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .delete()
          .eq("id", profile.id);
        
        if (profileError) {
          throw profileError;
        }

        // 5. Delete user from auth.users
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id);
        
        if (authError) {
          console.error(`Error deleting auth user ${profile.user_id}:`, authError);
          // Continue anyway, profile is already deleted
        }

        await supabaseAdmin.from("admin_activity_log").insert({
          action: "account_deleted",
          target_user_id: profile.user_id,
          details: { notified_email: notifyEmail, notified_sms: !!profile.phone_number },
        });

        deletedAccounts.push(profile.user_id);
        console.log(`Successfully deleted account for user: ${profile.user_id}`);
      } catch (error) {
        console.error(`Failed to delete account for user ${profile.user_id}:`, error);
        errors.push({
          userId: profile.user_id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const response = {
      message: "Cleanup completed",
      deletedCount: deletedAccounts.length,
      deletedAccounts,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Cleanup summary:", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cleanup function error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
