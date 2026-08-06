/**
 * Normalize a Nigerian phone number to the canonical 0XXXXXXXXXX format
 * used by the send-otp / verify-otp edge functions.
 * Trims spaces, dashes, brackets and the +234 / 234 country prefix.
 */
export function normalizePhone(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("234")) return `0${digits.slice(3)}`;
  if (digits.length === 11 && digits.startsWith("0")) return digits;
  if (digits.length === 10) return `0${digits}`;
  return digits;
}

/** Trim/strip while typing without forcing a full normalization. */
export function cleanPhoneInput(input: string): string {
  return (input || "").replace(/[^\d+]/g, "").slice(0, 14);
}
