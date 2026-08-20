import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push utilities
function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importPrivateKey(base64url: string) {
  const raw = base64UrlToUint8Array(base64url);
  return await crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJWT(
  audience: string,
  subject: string,
  privateKeyBase64url: string
): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const enc = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(privateKeyBase64url);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format for JWT
  const sigArray = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  
  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32);
  } else {
    // DER format
    let offset = 2;
    const rLen = sigArray[offset + 1];
    offset += 2;
    r = sigArray.slice(offset, offset + rLen);
    offset += rLen;
    const sLen = sigArray[offset + 1];
    offset += 2;
    s = sigArray.slice(offset, offset + sLen);
    
    // Trim leading zeros and pad to 32 bytes
    while (r.length > 32 && r[0] === 0) r = r.slice(1);
    while (s.length > 32 && s[0] === 0) s = s.slice(1);
    while (r.length < 32) r = new Uint8Array([0, ...r]);
    while (s.length < 32) s = new Uint8Array([0, ...s]);
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  const sigB64 = uint8ArrayToBase64Url(rawSig);
  return `${unsignedToken}.${sigB64}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPrivateKey: string,
  vapidPublicKey: string,
  vapidSubject: string
): Promise<"ok" | "expired" | "error"> {
  return await sendWebPushImpl(subscription, payload, vapidPrivateKey, vapidPublicKey, vapidSubject);
}

// ── RFC 8291 aes128gcm payload encryption ──
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

async function encryptPayload(
  payload: string,
  p256dhBase64url: string,
  authBase64url: string
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const uaPublic = base64UrlToUint8Array(p256dhBase64url);
  const authSecret = base64UrlToUint8Array(authBase64url);

  // Ephemeral sender key pair
  const asKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  ) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));

  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeyPair.privateKey, 256)
  );

  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = await hmac(prkKey, keyInfo);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);

  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const plaintext = concat(enc.encode(payload), new Uint8Array([2])); // 0x02 = last record delimiter
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext)
  );

  // header = salt(16) | record size(4) | key id length(1) | key id (as public key)
  const recordSize = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

async function sendWebPushImpl(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPrivateKey: string,
  vapidPublicKey: string,
  vapidSubject: string
): Promise<"ok" | "expired" | "error"> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await createJWT(audience, vapidSubject, vapidPrivateKey);

    // Push services reject unencrypted payloads — encrypt with aes128gcm (RFC 8291).
    const body = await encryptPayload(payload, subscription.p256dh, subscription.auth);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        Urgency: "high",
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body,
    });

    if (response.status === 410 || response.status === 404) {
      return "expired";
    }

    if (!response.ok) {
      console.error("Push endpoint rejected:", response.status, await response.text());
      return "error";
    }

    return "ok";
  } catch (e) {
    console.error("Web push error:", e);
    return "error";
  }
}

// ── FCM v1 (native Android/iOS via google-services.json) ──
function pemToPkcs8(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedFcmToken: { token: string; exp: number } | null = null;

async function getFcmAccessToken(sa: {
  client_email: string;
  private_key: string;
  token_uri?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmToken && cachedFcmToken.exp > now + 60) return cachedFcmToken.token;

  const enc = new TextEncoder();
  const header = uint8ArrayToBase64Url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = uint8ArrayToBase64Url(
    enc.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: sa.token_uri || "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claim}`))
  );
  const jwt = `${header}.${claim}.${uint8ArrayToBase64Url(sig)}`;

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`FCM token error: ${JSON.stringify(json)}`);
  cachedFcmToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

async function sendFcm(
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<"ok" | "expired" | "error"> {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) return "error";
  try {
    const sa = JSON.parse(raw);
    const accessToken = await getFcmAccessToken(sa);
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            android: {
              priority: "HIGH",
              notification: {
                channel_id: "harmic_alerts",
                sound: "default",
                default_vibrate_timings: true,
                notification_priority: "PRIORITY_MAX",
              },
            },
            apns: {
              headers: { "apns-priority": "10" },
              payload: { aps: { sound: "default", badge: 1 } },
            },
            data: Object.fromEntries(
              Object.entries({ ...data }).map(([k, v]) => [k, String(v ?? "")])
            ),
          },
        }),
      }
    );
    if (res.ok) return "ok";
    const text = await res.text();
    if (res.status === 404 || text.includes("UNREGISTERED") || text.includes("INVALID_ARGUMENT")) {
      console.error("FCM token invalid:", text);
      return "expired";
    }
    console.error("FCM send failed:", res.status, text);
    return "error";
  } catch (e) {
    console.error("FCM error:", e);
    return "error";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, ...params } = await req.json();

    // ── Save push subscription ──
    if (action === "subscribe") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { endpoint, p256dh, auth } = params;
      
      await supabase.from("push_subscriptions").upsert(
        { user_id: user.id, endpoint, p256dh, auth },
        { onConflict: "user_id,endpoint" }
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Unsubscribe ──
    if (action === "unsubscribe") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { endpoint } = params;
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get VAPID public key ──
    if (action === "vapid_public_key") {
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      if (!vapidPublicKey) {
        return new Response(
          JSON.stringify({ error: "VAPID keys not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ publicKey: vapidPublicKey }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Send notification to user(s) ──
    if (action === "send" || action === "push") {
      // This should only be called internally (service_role)
      const { user_id, user_ids, title, body, type, data } = params;

      const targetIds = user_ids || (user_id ? [user_id] : []);
      if (targetIds.length === 0) {
        return new Response(JSON.stringify({ error: "No target users" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store in-app notifications ("push" skips this — the caller already inserted the row)
      if (action === "send") {
        const notifications = targetIds.map((uid: string) => ({
          user_id: uid,
          title,
          body,
          type: type || "general",
          data: data || {},
        }));
        await supabase.from("notifications").insert(notifications);
      }

      // Send web push to all subscriptions
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

      if (vapidPrivateKey && vapidPublicKey) {
        for (const uid of targetIds) {
          const { data: subs } = await supabase
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", uid);

          if (subs) {
            for (const sub of subs) {
              const result = await sendWebPush(
                { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                JSON.stringify({ title, body, type, data }),
                vapidPrivateKey,
                vapidPublicKey,
                "mailto:harmicrecharge@harmicglobal.com"
              );

              // Remove only expired/gone subscriptions; keep them on transient errors
              if (result === "expired") {
                await supabase
                  .from("push_subscriptions")
                  .delete()
                  .eq("id", sub.id);
              }
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, sent: targetIds.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Notification error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
