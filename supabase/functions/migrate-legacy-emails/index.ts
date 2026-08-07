import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEGACY_DOMAIN = "eagles.local";
const PRIMARY_DOMAIN = "phone.harmicglobal.com";

// Migrates every <number>@eagles.local auth identity to <number>@phone.harmicglobal.com
// and marks it confirmed. Admin-only.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: userData } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let page = 1;
    let migrated = 0;
    const failures: { id: string; error: string }[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const users = data?.users ?? [];
      if (users.length === 0) break;

      for (const u of users) {
        const email = u.email ?? "";
        if (!email.endsWith(`@${LEGACY_DOMAIN}`)) continue;
        const digits = email.split("@")[0].replace(/\D/g, "");
        const newEmail = `${digits}@${PRIMARY_DOMAIN}`;

        const { error: updErr } = await admin.auth.admin.updateUserById(u.id, {
          email: newEmail,
          email_confirm: true,
        });
        if (updErr) {
          failures.push({ id: u.id, error: updErr.message });
          continue;
        }
        await admin.from("profiles").update({ email: newEmail }).eq("user_id", u.id);
        migrated++;
      }

      if (users.length < 200) break;
      page++;
    }

    return new Response(JSON.stringify({ success: true, migrated, failures }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
