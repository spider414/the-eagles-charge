import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyAdminNewRegistration } from "../_shared/notify-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIMARY_DOMAIN = "phone.harmicglobal.com";
const LEGACY_DOMAIN = "eagles.local";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone_number, password, full_name } = await req.json();
    const digits = String(phone_number ?? "").replace(/\D/g, "");

    if (digits.length < 10 || digits.length > 15) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof password !== "string" || password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const email = `${digits}@${PRIMARY_DOMAIN}`;
    const legacyEmail = `${digits}@${LEGACY_DOMAIN}`;

    // Already registered? (either identity format)
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("user_id, email")
      .in("email", [email, legacyEmail])
      .maybeSingle();

    if (existingProfile) {
      // Migrate legacy identity on the fly so the user can log in with the new one.
      if (existingProfile.email === legacyEmail) {
        await admin.auth.admin.updateUserById(existingProfile.user_id, {
          email,
          email_confirm: true,
        });
        await admin.from("profiles").update({ email }).eq("user_id", existingProfile.user_id);
      }
      return new Response(JSON.stringify({ error: "This phone number is already registered" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the user pre-confirmed so no confirmation email is required.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { phone_number: digits, full_name: full_name ?? null },
    });

    if (error || !data?.user) {
      const msg = error?.message ?? "Could not create account";
      const alreadyExists = /already/i.test(msg);
      return new Response(
        JSON.stringify({ error: alreadyExists ? "This phone number is already registered" : msg }),
        { status: alreadyExists ? 409 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Alert the admin about the new registration (best-effort).
    await notifyAdminNewRegistration(admin, {
      user_id: data.user.id,
      phone_number: digits,
      full_name: full_name ?? null,
    });

    return new Response(JSON.stringify({ success: true, user_id: data.user.id, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
