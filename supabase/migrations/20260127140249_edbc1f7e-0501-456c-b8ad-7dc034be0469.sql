-- Fix: remove overly-permissive RLS policy on otp_verifications
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'otp_verifications'
      AND policyname = 'Allow anonymous OTP operations'
  ) THEN
    EXECUTE 'DROP POLICY "Allow anonymous OTP operations" ON public.otp_verifications';
  END IF;
END $$;

-- Keep RLS enabled. With no policies, direct client access is denied.
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;