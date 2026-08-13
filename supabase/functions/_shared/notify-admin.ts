// Best-effort admin notifications. Never throws — callers must not fail because
// an email could not be delivered.
const DEFAULT_ADMIN_EMAIL = "harmicrecharge@harmicglobal.com";

type AnyClient = {
  from: (t: string) => any;
  functions: { invoke: (name: string, opts: { body: unknown }) => Promise<unknown> };
};

async function adminEmail(client: AnyClient): Promise<string> {
  try {
    const { data } = await client
      .from("email_settings")
      .select("admin_notify_email, support_email")
      .limit(1)
      .maybeSingle();
    return data?.admin_notify_email || data?.support_email || DEFAULT_ADMIN_EMAIL;
  } catch {
    return DEFAULT_ADMIN_EMAIL;
  }
}

async function send(client: AnyClient, body: Record<string, unknown>) {
  try {
    const to = await adminEmail(client);
    await client.functions.invoke("send-email", { body: { ...body, to } });
  } catch (e) {
    console.error("admin notification failed", e);
  }
}

export async function notifyAdminNewRegistration(
  client: AnyClient,
  info: { user_id: string; phone_number?: string; full_name?: string | null; email?: string | null; referral_code?: string | null },
) {
  await send(client, { type: "admin_new_registration", ...info });
}

export async function notifyAdminTransactionFailed(
  client: AnyClient,
  transactionId: string,
  reason: string,
) {
  try {
    const { data: tx } = await client
      .from("transactions")
      .select("id, user_id, transaction_type, amount, phone_number, network, description")
      .eq("id", transactionId)
      .maybeSingle();
    if (!tx) return;
    const { data: profile } = await client
      .from("profiles")
      .select("full_name, phone_number, contact_email")
      .eq("user_id", tx.user_id)
      .maybeSingle();
    await send(client, {
      type: "admin_transaction_failed",
      transaction_id: tx.id,
      user_id: tx.user_id,
      user_name: profile?.full_name ?? null,
      user_phone: profile?.phone_number ?? tx.phone_number ?? null,
      user_email: profile?.contact_email ?? null,
      transaction_type: tx.transaction_type,
      amount: Number(tx.amount) || 0,
      network: tx.network ?? null,
      reason,
    });
  } catch (e) {
    console.error("failed-transaction notification failed", e);
  }
}
