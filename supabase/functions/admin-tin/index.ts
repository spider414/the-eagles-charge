import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the calling user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role using service client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, transaction_id, tin_number } = await req.json();

    if (action === "list") {
      // List all TIN requests
      const { data, error } = await adminClient
        .from("transactions")
        .select("id, user_id, amount, status, data_plan, api_response, phone_number, created_at, description")
        .like("data_plan", "tin-%")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get user emails for display
      const userIds = [...new Set((data || []).map((t: any) => t.user_id))];
      const profiles: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profileData } = await adminClient
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds);
        (profileData || []).forEach((p: any) => {
          profiles[p.user_id] = p.full_name || p.email;
        });
      }

      const enriched = (data || []).map((t: any) => ({
        ...t,
        user_display: profiles[t.user_id] || t.user_id,
      }));

      return new Response(JSON.stringify({ success: true, data: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "complete") {
      if (!transaction_id || !tin_number) {
        return new Response(JSON.stringify({ error: "transaction_id and tin_number are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get existing transaction
      const { data: txn, error: txnError } = await adminClient
        .from("transactions")
        .select("*")
        .eq("id", transaction_id)
        .single();

      if (txnError || !txn) {
        return new Response(JSON.stringify({ error: "Transaction not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update transaction with TIN and mark as completed
      const existingResponse = (txn.api_response as any) || {};
      const { error: updateError } = await adminClient
        .from("transactions")
        .update({
          status: "completed",
          api_response: { ...existingResponse, tin: tin_number },
        })
        .eq("id", transaction_id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, message: "TIN updated successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin TIN error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
