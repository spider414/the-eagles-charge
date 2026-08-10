import { describe, it, expect } from "vitest";

/**
 * End-to-end check that admin-only API endpoints reject non-admin callers even
 * when the UI is bypassed (direct HTTP calls with the public anon key).
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const call = (fn: string, body: unknown, token: string) =>
  fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

describe("admin-only endpoints reject non-admins", () => {
  it("provider wallet balance rejects an anonymous/non-admin token", async () => {
    const res = await call("vtu-service", { action: "provider_wallet_balance" }, ANON_KEY);
    await res.text();
    expect([401, 403]).toContain(res.status);
  });

  it("legacy email migration rejects an anonymous/non-admin token", async () => {
    const res = await call("migrate-legacy-emails", {}, ANON_KEY);
    await res.text();
    expect([401, 403]).toContain(res.status);
  });

  it("admin tables are not readable with the anon key", async () => {
    for (const table of ["admin_activity_log", "otp_audit_log", "email_send_log"]) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      });
      const text = await res.text();
      expect(res.status === 200 ? JSON.parse(text) : []).toEqual([]);
    }
  });
});
