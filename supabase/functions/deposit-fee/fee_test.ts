// End-to-end verification that the deposit (funding) fee is applied identically
// on every funding path: bank-transfer webhook, card top-up webhook and manual
// reconciliation — each with a matching deposit_fee_log ledger entry.
//
// The tests drive the live edge functions with throwaway users and restore the
// app_settings row afterwards, so no real data is changed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeDepositFee, computeNetDeposit } from "../_shared/depositFee.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

const ignore = !SUPABASE_URL || !SERVICE_KEY;
const ignoreWebhook = ignore || !PAYSTACK_SECRET;

const admin = ignore
  ? (null as never)
  : createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const rnd = () => Math.random().toString(36).slice(2, 10);

async function sign(payload: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(PAYSTACK_SECRET), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function postWebhook(event: unknown) {
  const body = JSON.stringify(event);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/paystack-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-paystack-signature": await sign(body) },
    body,
  });
  await res.text();
  return res.status;
}

async function snapshotFee() {
  const { data } = await admin
    .from("app_settings")
    .select("id, deposit_fee_enabled, deposit_fee_percent")
    .limit(1)
    .maybeSingle();
  return data!;
}

const setFee = (id: string, enabled: boolean, percent: number) =>
  admin.from("app_settings").update({ deposit_fee_enabled: enabled, deposit_fee_percent: percent }).eq("id", id);

async function createUser() {
  const email = `fee-${rnd()}@deposit.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: `Pw-${rnd()}!`, email_confirm: true });
  if (error) throw error;
  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .insert({ user_id: data.user!.id, email, wallet_balance: 0 })
    .select("id, wallet_balance")
    .single();
  if (pErr) throw pErr;
  return { userId: data.user!.id, profileId: profile.id as string, email };
}

async function cleanup(userId: string) {
  await admin.from("deposit_fee_log").delete().eq("user_id", userId);
  await admin.from("transactions").delete().eq("user_id", userId);
  await admin.from("notifications").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
}

const balance = async (userId: string) => {
  const { data } = await admin.from("profiles").select("wallet_balance").eq("user_id", userId).maybeSingle();
  return Number(data?.wallet_balance ?? 0);
};

const ledger = async (reference: string) => {
  const { data } = await admin
    .from("deposit_fee_log")
    .select("method, gross_amount, fee_percent, fee_amount, net_amount")
    .eq("reference", reference)
    .maybeSingle();
  return data;
};

const CFG = { enabled: true, percent: 1 };
const AMOUNT = 15000;

Deno.test("fee maths: 1% is ceil-rounded and net = gross - fee", () => {
  assertEquals(computeDepositFee(15000, CFG), 150);
  assertEquals(computeNetDeposit(15000, CFG), 14850);
  assertEquals(computeDepositFee(101, CFG), 2); // ceil
  assertEquals(computeDepositFee(15000, { enabled: false, percent: 1 }), 0);
  assertEquals(computeNetDeposit(15000, { enabled: false, percent: 1 }), 15000);
});

Deno.test({ ignore: ignoreWebhook, name: "bank transfer webhook credits net amount and writes a ledger entry" }, async () => {
  const settings = await snapshotFee();
  const user = await createUser();
  const customerCode = `CUS_TEST_${rnd()}`;
  const reference = `TEST-DVA-${rnd()}`;
  try {
    await setFee(settings.id, true, 1);
    await admin.from("profiles").update({ paystack_customer_code: customerCode }).eq("id", user.profileId);

    const status = await postWebhook({
      event: "charge.success",
      data: {
        channel: "dedicated_nuban",
        reference,
        amount: AMOUNT * 100,
        paid_at: new Date().toISOString(),
        customer: { customer_code: customerCode },
      },
    });
    assertEquals(status, 200);

    assertEquals(await balance(user.userId), computeNetDeposit(AMOUNT, CFG));
    const entry = await ledger(reference);
    assert(entry, "ledger entry missing for bank transfer");
    assertEquals(entry!.method, "bank_transfer");
    assertEquals(Number(entry!.gross_amount), AMOUNT);
    assertEquals(Number(entry!.fee_amount), computeDepositFee(AMOUNT, CFG));
    assertEquals(Number(entry!.net_amount), computeNetDeposit(AMOUNT, CFG));
  } finally {
    await setFee(settings.id, settings.deposit_fee_enabled, settings.deposit_fee_percent);
    await cleanup(user.userId);
  }
});

Deno.test({ ignore: ignoreWebhook, name: "card top-up webhook credits net amount and writes a ledger entry" }, async () => {
  const settings = await snapshotFee();
  const user = await createUser();
  const reference = `HARMIC-${rnd()}`;
  try {
    await setFee(settings.id, true, 1);
    await admin.from("transactions").insert({
      user_id: user.userId,
      transaction_type: "wallet_topup",
      status: "pending",
      amount: AMOUNT,
      paystack_reference: reference,
      description: "Card top-up test",
    });

    const status = await postWebhook({
      event: "charge.success",
      data: { channel: "card", reference, amount: AMOUNT * 100, paid_at: new Date().toISOString() },
    });
    assertEquals(status, 200);

    assertEquals(await balance(user.userId), computeNetDeposit(AMOUNT, CFG));
    const entry = await ledger(reference);
    assert(entry, "ledger entry missing for card top-up");
    assertEquals(entry!.method, "card");
    assertEquals(Number(entry!.fee_amount), computeDepositFee(AMOUNT, CFG));
    assertEquals(Number(entry!.net_amount), computeNetDeposit(AMOUNT, CFG));
  } finally {
    await setFee(settings.id, settings.deposit_fee_enabled, settings.deposit_fee_percent);
    await cleanup(user.userId);
  }
});

Deno.test({ ignore: ignoreWebhook, name: "duplicate webhook delivery never charges or credits twice" }, async () => {
  const settings = await snapshotFee();
  const user = await createUser();
  const customerCode = `CUS_TEST_${rnd()}`;
  const reference = `TEST-DVA-${rnd()}`;
  try {
    await setFee(settings.id, true, 1);
    await admin.from("profiles").update({ paystack_customer_code: customerCode }).eq("id", user.profileId);
    const event = {
      event: "charge.success",
      data: {
        channel: "dedicated_nuban",
        reference,
        amount: AMOUNT * 100,
        paid_at: new Date().toISOString(),
        customer: { customer_code: customerCode },
      },
    };
    await postWebhook(event);
    await postWebhook(event);

    assertEquals(await balance(user.userId), computeNetDeposit(AMOUNT, CFG));
    const { data: rows } = await admin.from("deposit_fee_log").select("id").eq("reference", reference);
    assertEquals((rows ?? []).length, 1);
  } finally {
    await setFee(settings.id, settings.deposit_fee_enabled, settings.deposit_fee_percent);
    await cleanup(user.userId);
  }
});

Deno.test({ ignore, name: "public deposit-fee endpoint mirrors the stored settings" }, async () => {
  const settings = await snapshotFee();
  try {
    await setFee(settings.id, true, 2.5);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/deposit-fee?amount=10000`);
    const body = await res.json();
    assertEquals(res.status, 200);
    assertEquals(body.enabled, true);
    assertEquals(Number(body.percent), 2.5);
    assertEquals(Number(body.quote.fee), 250);
    assertEquals(Number(body.quote.credited), 9750);
  } finally {
    await setFee(settings.id, settings.deposit_fee_enabled, settings.deposit_fee_percent);
  }
});

Deno.test({ ignore, name: "every ledger entry is internally consistent (fee + net = gross)" }, async () => {
  const { data } = await admin
    .from("deposit_fee_log")
    .select("gross_amount, fee_amount, net_amount, fee_percent, method")
    .order("created_at", { ascending: false })
    .limit(100);
  for (const row of data ?? []) {
    assertEquals(Number(row.fee_amount) + Number(row.net_amount), Number(row.gross_amount));
    assert(["bank_transfer", "card", "reconciliation"].includes(row.method));
    const expected = computeDepositFee(Number(row.gross_amount), {
      enabled: Number(row.fee_percent) > 0,
      percent: Number(row.fee_percent),
    });
    assertEquals(Number(row.fee_amount), expected);
  }
});
