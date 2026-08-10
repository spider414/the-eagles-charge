import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export type CallerCheck =
  | { ok: true; userId: string | null; isAdmin: boolean; isService: boolean }
  | { ok: false; status: number; error: string };

/**
 * Validates the bearer token server-side and resolves admin status from the
 * user_roles table (via the has_role security-definer function).
 * Never trust role/ownership values supplied in the request body.
 */
export async function resolveCaller(req: Request): Promise<CallerCheck> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const token = authHeader.replace("Bearer ", "").trim();
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return { ok: true, userId: null, isAdmin: true, isService: true };
  }
  const admin = serviceClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: "Invalid token" };
  }
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: data.user.id,
    _role: "admin",
  });
  return { ok: true, userId: data.user.id, isAdmin: !!isAdmin, isService: false };
}

/** Returns a Response when the caller is not an admin, otherwise null. */
export async function requireAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ error: Response } | { userId: string | null; isService: boolean }> {
  const caller = await resolveCaller(req);
  if (!caller.ok) {
    return {
      error: new Response(JSON.stringify({ error: caller.error }), {
        status: caller.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  if (!caller.isAdmin) {
    await logAdminActivity({
      actorUserId: caller.userId,
      action: "admin_access_denied",
      details: { path: new URL(req.url).pathname },
    });
    return {
      error: new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  await logAdminActivity({
    actorUserId: caller.userId,
    action: "admin_access_granted",
    details: { path: new URL(req.url).pathname, service: caller.isService },
  });
  return { userId: caller.userId, isService: caller.isService };
}


/** Best-effort write to the admin activity log (service role bypasses RLS). */
export async function logAdminActivity(entry: {
  actorUserId?: string | null;
  action: string;
  targetUserId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    await serviceClient().from("admin_activity_log").insert({
      actor_user_id: entry.actorUserId ?? null,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      details: entry.details ?? {},
    });
  } catch (e) {
    console.error("admin_activity_log insert failed", e);
  }
}
