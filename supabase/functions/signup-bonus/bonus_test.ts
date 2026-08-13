// Automated verification of the registration bonus rules against the live
// Supabase project. Every test creates throwaway users and deletes them again,
// and the app_settings row is snapshotted and restored, so no real data changes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const rnd = () => Math.random().toString(36).slice(2, 10);

async function snapshotSettings() {
  const { data } = await admin
    .from("app_settings")
    .select("id, registration_bonus_enabled, registration_bonus_amount")
    .limit(1)
    .maybeSingle();
  return data!;
}

async function setBonus(id: string, enabled: boolean, amount: number) {
  await admin
    .from("app_settings")
    .update({ registration_bonus_enabled: enabled, registration_bonus_amount: amount })
    .eq("id", id);
}

async function createUser() {
  const email = `test-${rnd()}@bonus.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Pw-${rnd()}!`,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user!.id, email };
}

async function createProfile(userId: string, email: string, referredBy?: string) {
  const { data, error } = await admin
    .from("profiles")
    .insert({ user_id: userId, email, wallet_balance: 0, referred_by: referredBy ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function balance(userId: string) {
  const { data } = await admin.from("profiles").select("wallet_balance").eq("user_id", userId).maybeSingle();
  return Number(data?.wallet_balance ?? 0);
}

async function welcomeTx(userId: string) {
  const { data } = await admin
    .from("transactions")
    .select("id, amount")
    .eq("user_id", userId)
    .eq("description", "Welcome bonus");
  return data ?? [];
}

async function cleanup(userIds: string[]) {
  for (const id of userIds) {
    await admin.from("transactions").delete().eq("user_id", id);
    await admin.from("notifications").delete().eq("user_id", id);
    await admin.from("profiles").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

Deno.test("registration bonus ON credits the configured amount exactly once", async () => {
  const settings = await snapshotSettings();
  const user = await createUser();
  try {
    await setBonus(settings.id, true, 1500);
    await createProfile(user.id, user.email);

    assertEquals(await balance(user.id), 1500);
    const txs = await welcomeTx(user.id);
    assertEquals(txs.length, 1);
    assertEquals(Number(txs[0].amount), 1500);
  } finally {
    await setBonus(settings.id, settings.registration_bonus_enabled, settings.registration_bonus_amount);
    await cleanup([user.id]);
  }
});

Deno.test("registration bonus OFF credits nothing", async () => {
  const settings = await snapshotSettings();
  const user = await createUser();
  try {
    await setBonus(settings.id, false, 1500);
    await createProfile(user.id, user.email);

    assertEquals(await balance(user.id), 0);
    assertEquals((await welcomeTx(user.id)).length, 0);
  } finally {
    await setBonus(settings.id, settings.registration_bonus_enabled, settings.registration_bonus_amount);
    await cleanup([user.id]);
  }
});

Deno.test("bonus is idempotent - a second profile insert never pays twice", async () => {
  const settings = await snapshotSettings();
  const user = await createUser();
  try {
    await setBonus(settings.id, true, 1500);
    await createProfile(user.id, user.email);
    assertEquals((await welcomeTx(user.id)).length, 1);

    // Simulate a retry / duplicate signup path for the same user.
    await admin.from("profiles").delete().eq("user_id", user.id);
    await createProfile(user.id, user.email);

    assertEquals((await welcomeTx(user.id)).length, 1);
    assertEquals(await balance(user.id), 0); // fresh row, no second bonus
  } finally {
    await setBonus(settings.id, settings.registration_bonus_enabled, settings.registration_bonus_amount);
    await cleanup([user.id]);
  }
});

Deno.test("referral system stays independent of the welcome bonus", async () => {
  const settings = await snapshotSettings();
  const referrer = await createUser();
  const referred = await createUser();
  try {
    await setBonus(settings.id, true, 1500);
    const referrerProfileId = await createProfile(referrer.id, referrer.email);
    const referrerStart = await balance(referrer.id);

    const referredProfileId = await createProfile(referred.id, referred.email, referrerProfileId);

    // Welcome bonus paid to the referred user...
    assertEquals(await balance(referred.id), 1500);
    // ...but it must not trigger a referral payout.
    const { data: rewards } = await admin
      .from("referral_rewards")
      .select("id")
      .eq("referred_id", referredProfileId);
    assertEquals((rewards ?? []).length, 0);
    assertEquals(await balance(referrer.id), referrerStart);

    // A real funding transaction does trigger the ₦1,000 referral reward.
    await admin.from("transactions").insert({
      user_id: referred.id,
      transaction_type: "wallet_topup",
      status: "completed",
      amount: 1000,
      description: "Test deposit",
    });

    const { data: rewards2 } = await admin
      .from("referral_rewards")
      .select("id, reward_amount")
      .eq("referred_id", referredProfileId);
    assertEquals((rewards2 ?? []).length, 1);
    assertEquals(Number(rewards2![0].reward_amount), 1000);
    assert((await balance(referrer.id)) === referrerStart + 1000);
  } finally {
    await setBonus(settings.id, settings.registration_bonus_enabled, settings.registration_bonus_amount);
    await cleanup([referred.id, referrer.id]);
  }
});
