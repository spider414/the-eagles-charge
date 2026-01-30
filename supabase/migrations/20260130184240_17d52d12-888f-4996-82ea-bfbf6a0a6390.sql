-- Add explicit DENY policies for referral_rewards write operations
-- This provides defense-in-depth against accidental policy additions

-- Explicitly block INSERT from regular users
CREATE POLICY "Deny user INSERT on referral_rewards" 
ON public.referral_rewards
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Explicitly block UPDATE from regular users  
CREATE POLICY "Deny user UPDATE on referral_rewards"
ON public.referral_rewards  
FOR UPDATE
TO authenticated
USING (false);

-- Explicitly block DELETE from regular users
CREATE POLICY "Deny user DELETE on referral_rewards"
ON public.referral_rewards
FOR DELETE
TO authenticated
USING (false);

-- Revoke EXECUTE permissions on sensitive wallet functions from public/authenticated roles
-- Only service_role should be able to call these functions
REVOKE EXECUTE ON FUNCTION public.debit_wallet(UUID, DECIMAL) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debit_wallet(UUID, DECIMAL) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet(UUID, DECIMAL) FROM anon;

REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID, DECIMAL) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID, DECIMAL) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID, DECIMAL) FROM anon;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otps() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otps() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otps() FROM anon;

-- Grant EXECUTE only to service_role for these functions
GRANT EXECUTE ON FUNCTION public.debit_wallet(UUID, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_wallet(UUID, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_otps() TO service_role;

-- Add comment documenting that otp_code should be hashed
COMMENT ON COLUMN public.otp_verifications.otp_code IS 'SHA-256 hash of the OTP code - never store plaintext OTPs';