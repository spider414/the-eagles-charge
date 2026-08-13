// Server-authoritative deposit (funding) fee.
// Percentage and on/off switch live in public.app_settings so admins can change
// them at any time without shipping a new mobile build.

export interface DepositFeeConfig {
  enabled: boolean;
  percent: number; // e.g. 1 = 1%
}

// deno-lint-ignore no-explicit-any
type Client = any;

export const DEFAULT_DEPOSIT_FEE: DepositFeeConfig = { enabled: true, percent: 1 };

export async function getDepositFeeConfig(supabase: Client): Promise<DepositFeeConfig> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("deposit_fee_enabled, deposit_fee_percent")
      .limit(1)
      .maybeSingle();
    if (error || !data) return DEFAULT_DEPOSIT_FEE;
    const percent = Number(data.deposit_fee_percent);
    return {
      enabled: data.deposit_fee_enabled !== false,
      percent: Number.isFinite(percent) && percent >= 0 ? percent : DEFAULT_DEPOSIT_FEE.percent,
    };
  } catch (_e) {
    return DEFAULT_DEPOSIT_FEE;
  }
}

export function computeDepositFee(amount: number, cfg: DepositFeeConfig): number {
  if (!cfg.enabled || cfg.percent <= 0) return 0;
  return Math.ceil(((amount || 0) * cfg.percent) / 100);
}

export function computeNetDeposit(amount: number, cfg: DepositFeeConfig): number {
  return Math.max(0, (amount || 0) - computeDepositFee(amount, cfg));
}

/** Write the matching ledger entry for a credited deposit. Never throws. */
export async function logDepositFee(
  supabase: Client,
  entry: {
    user_id: string;
    transaction_id?: string | null;
    reference?: string | null;
    method: "bank_transfer" | "card" | "reconciliation";
    gross_amount: number;
    fee_percent: number;
    fee_amount: number;
    net_amount: number;
    balance_after?: number | null;
  },
) {
  try {
    const { error } = await supabase.from("deposit_fee_log").insert(entry);
    if (error && (error as { code?: string }).code !== "23505") {
      console.error("deposit_fee_log insert failed:", error);
    } else {
      console.log(
        `[deposit-fee] ${entry.method} ref=${entry.reference ?? "-"} gross=₦${entry.gross_amount} ` +
          `fee=₦${entry.fee_amount} (${entry.fee_percent}%) net=₦${entry.net_amount}`,
      );
    }
  } catch (e) {
    console.error("deposit_fee_log error:", e);
  }
}
