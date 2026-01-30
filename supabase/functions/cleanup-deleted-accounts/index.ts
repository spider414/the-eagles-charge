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

    // Find all profiles scheduled for deletion where the deletion date has passed
    const { data: profilesToDelete, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, email, phone_number")
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
