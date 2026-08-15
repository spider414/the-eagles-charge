import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyAdminNewRegistration } from "../_shared/notify-admin.ts";
import { namesMatch } from "../_shared/nameMatch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIMARY_DOMAIN = "phone.harmicglobal.com";
const LEGACY_DOMAIN = "eagles.local";

function localPhone(digits: string): string {
  if (digits.length === 13 && digits.startsWith("234")) return "0" + digits.slice(3);
  if (digits.length === 10) return "0" + digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone_number, password, full_name, device_fingerprint } = await req.json();
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

    // ---- NIN identity check (admin-toggleable) ---------------------------
    const { data: settings } = await admin
      .from("app_settings")
      .select("nin_verification_required")
      .limit(1)
      .maybeSingle();

    if (settings?.nin_verification_required) {
      const { data: ninRecord } = await admin
        .from("nin_verifications")
        .select("full_name, expires_at")
        .eq("phone_number", localPhone(digits))
        .maybeSingle();

      if (!ninRecord || new Date(ninRecord.expires_at as string).getTime() < Date.now()) {
        return new Response(
          JSON.stringify({
            error: "Please verify the NIN linked to this phone number before creating your account.",
            code: "nin_required",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!namesMatch(String(full_name ?? ""), String(ninRecord.full_name ?? ""))) {
        return new Response(
          JSON.stringify({
            error:
              "The name you entered does not match the name on the NIN linked to this phone number. Please use your NIN name.",
            code: "nin_name_mismatch",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ---- One account per device / IP -------------------------------------
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;
    const fingerprint = String(device_fingerprint ?? "").slice(0, 128) || (ip ? `ip:${ip}` : null);

    if (fingerprint) {
      const { data: device } = await admin
        .from("device_registrations")
        .select("*")
        .eq("fingerprint", fingerprint)
        .maybeSingle();

      if (device?.blocked) {
        return new Response(
          JSON.stringify({
            error:
              "This device has been blocked from creating new accounts. Please contact support if you believe this is a mistake.",
            code: "device_blocked",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (device && device.user_id && device.phone_number !== digits) {
        const attempts = (device.attempts ?? 0) + 1;
        const shouldBlock = attempts >= 3;
        await admin
          .from("device_registrations")
          .update({
            attempts,
            last_attempt_at: new Date().toISOString(),
            ip_address: ip,
            blocked: shouldBlock,
            blocked_reason: shouldBlock ? "Repeated multi-account attempts from one device" : null,
          })
          .eq("id", device.id);

        return new Response(
          JSON.stringify({
            error: shouldBlock
              ? "This device has been blocked after repeated attempts to open multiple accounts."
              : "Only one account is allowed per device. Please log in with the account already registered on this phone.",
            code: shouldBlock ? "device_blocked" : "device_limit",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

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

    if (fingerprint) {
      await admin.from("device_registrations").upsert(
        {
          fingerprint,
          ip_address: ip,
          user_id: data.user.id,
          phone_number: digits,
          last_attempt_at: new Date().toISOString(),
        },
        { onConflict: "fingerprint" },
      );
    }

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
