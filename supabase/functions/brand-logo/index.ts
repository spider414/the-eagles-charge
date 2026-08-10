import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const contentTypeFor = (path: string) =>
  path.endsWith(".png") ? "image/png"
  : path.endsWith(".webp") ? "image/webp"
  : path.endsWith(".svg") ? "image/svg+xml"
  : "image/jpeg";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    // Resolve the configured logo object path (stored path or full URL)
    const { data: settings } = await admin
      .from("email_settings")
      .select("logo_url")
      .limit(1)
      .maybeSingle();

    let path = (settings?.logo_url ?? "").trim();
    if (path.includes("/branding/")) path = path.split("/branding/")[1].split("?")[0];
    if (!path || path.startsWith("http")) {
      // Fall back to the most recent object in the branding bucket
      const { data: list } = await admin.storage.from("branding").list("", {
        limit: 1,
        sortBy: { column: "created_at", order: "desc" },
      });
      path = list?.[0]?.name ?? "";
    }
    if (!path) return new Response("No logo configured", { status: 404, headers: cors });

    const { data: file, error } = await admin.storage.from("branding").download(path);
    if (error || !file) return new Response("Logo not found", { status: 404, headers: cors });

    return new Response(await file.arrayBuffer(), {
      headers: {
        ...cors,
        "Content-Type": contentTypeFor(path),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    console.error("brand-logo error", e);
    return new Response("Error", { status: 500, headers: cors });
  }
});
