// Platform service fee: 2% on every service EXCEPT airtime (recharge card) and wallet top-ups.
// The server (paystack-payment edge function) is authoritative — these helpers exist so the
// UI can display the same totals the user will actually be charged.
export const SERVICE_FEE_RATE = 0.02;

const FEE_EXEMPT_TYPES = new Set(["airtime", "wallet_topup"]);

export const serviceFee = (transactionType: string, baseAmount: number): number =>
  FEE_EXEMPT_TYPES.has(transactionType) ? 0 : Math.ceil((baseAmount || 0) * SERVICE_FEE_RATE);

export const chargeTotal = (transactionType: string, baseAmount: number): number =>
  (baseAmount || 0) + serviceFee(transactionType, baseAmount);

export const formatNaira = (value: number): string => `₦${(value || 0).toLocaleString()}`;

// Funding fee: a percentage (1% by default) is deducted from every wallet deposit
// (bank transfer or card). The percentage and on/off switch are stored in
// app_settings and controlled by admins; the server is authoritative.
export const DEFAULT_DEPOSIT_FEE_PERCENT = 1;

export interface DepositFeeSettings {
  enabled?: boolean;
  percent?: number; // e.g. 1 = 1%
}

export const depositFee = (amount: number, settings?: DepositFeeSettings): number => {
  const enabled = settings?.enabled ?? true;
  const percent = settings?.percent ?? DEFAULT_DEPOSIT_FEE_PERCENT;
  if (!enabled || percent <= 0) return 0;
  return Math.ceil(((amount || 0) * percent) / 100);
};

export const netDeposit = (amount: number, settings?: DepositFeeSettings): number =>
  Math.max(0, (amount || 0) - depositFee(amount, settings));
