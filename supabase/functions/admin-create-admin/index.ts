import { resolveCaller, serviceClient, logAdminActivity } from "../_shared/admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PRIMARY_DOMAIN = "phone.harmicglobal.com";
const LEGACY_DOMAIN = "eagles.local";
const ALLOWED = ["all", "users", "recovery", "campaigns", "email", "verification", "finance", "logs"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const caller = await resolveCaller(req);
    if (!caller.ok) return json({ error: caller.error }, caller.status);

    const admin = serviceClient();

    if (!caller.isService) {
      const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: caller.userId });
      if (!isSuper) {
        await logAdminActivity({
          actorUserId: caller.userId,
          action: "admin_access_denied",
          details: { path: "admin-create-admin" },
        });
        return json({ error: "Only the general admin can register new admins" }, 403);
      }
    }

    const body = await req.json();
    const fullName = String(body.full_name ?? "").trim();
    const contactEmail = String(body.contact_email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const digits = String(body.phone_number ?? "").replace(/\D/g, "");
    const scopes: string[] = Array.isArray(body.scopes) ? body.scopes.filter((s: string) => ALLOWED.includes(s)) : [];

    if (fullName.length < 2) return json({ error: "Please enter the person's full name" }, 400);
    if (digits.length < 10 || digits.length > 15) return json({ error: "Please enter a valid phone number" }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return json({ error: "Please enter a valid email address" }, 400);
    }
    if (scopes.length === 0) return json({ error: "Choose at least one work area for this admin" }, 400);

    const email = `${digits}@${PRIMARY_DOMAIN}`;
    const legacyEmail = `${digits}@${LEGACY_DOMAIN}`;

    const { data: existing } = await admin
      .from("profiles")
      .select("user_id")
      .in("email", [email, legacyEmail])
      .maybeSingle();

    let userId = existing?.user_id as string | undefined;
    let created = false;

    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { phone_number: digits, full_name: fullName },
      });
      if (error || !data?.user) {
        return json({ error: error?.message ?? "Could not create the admin account" }, 400);
      }
      userId = data.user.id;
      created = true;

      const { error: profileError } = await admin.from("profiles").insert({
        user_id: userId,
        email,
        phone_number: digits,
        full_name: fullName,
        contact_email: contactEmail || null,
        contact_email_verified: !!contactEmail,
      });
      if (profileError) console.error("profile insert failed", profileError);
    } else {
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      await admin
        .from("profiles")
        .update({
          full_name: fullName,
          ...(contactEmail ? { contact_email: contactEmail, contact_email_verified: true } : {}),
        })
        .eq("user_id", userId);
    }

    await admin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    await admin.from("admin_scopes").delete().eq("user_id", userId);
    await admin.from("admin_scopes").insert(scopes.map((scope) => ({ user_id: userId, scope })));

    await logAdminActivity({
      actorUserId: caller.userId,
      action: created ? "admin_registered" : "admin_scopes_updated",
      targetUserId: userId,
      details: { scopes, phone_number: digits, created },
    });

    if (contactEmail) {
      await admin.functions
        .invoke("send-email", {
          body: {
            type: "admin_message",
            to: contactEmail,
            name: fullName,
            subject: "You have been added as an admin",
            heading: "Your admin account is ready",
            message:
              `An admin account was created for you on HARMIC RECHARGE.\n\n` +
              `Login phone: ${digits}\nTemporary password: ${password}\n\n` +
              `Please sign in at /admin and change your password right away.`,
          },
        })
        .catch(() => null);
    }

    return json({ success: true, user_id: userId, created, login_phone: digits });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
