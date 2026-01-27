-- Fix: OTP verifications table should be server-side only (no user access)
-- The table has RLS enabled but no policies, which means users cannot access it.
-- This is actually correct - OTPs should only be managed by service role in edge functions.
-- We need to ensure this is intentional by adding a comment, but the current state is secure.

-- Add explicit policy that blocks all authenticated user access (defense in depth)
CREATE POLICY "Block all user access to OTP table"
ON public.otp_verifications
FOR ALL
TO authenticated
USING (false);

-- This ensures even if someone tries to access directly, they cannot