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

// Funding fee: 1% is deducted from every wallet deposit (bank transfer or card).
// The server (paystack webhook / payment function) is authoritative.
export const DEPOSIT_FEE_RATE = 0.01;

export const depositFee = (amount: number): number =>
  Math.ceil((amount || 0) * DEPOSIT_FEE_RATE);

export const netDeposit = (amount: number): number =>
  Math.max(0, (amount || 0) - depositFee(amount));
