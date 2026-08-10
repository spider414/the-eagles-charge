ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_email_verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  new_email text NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL DEFAULT 'email_change',
  attempts integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_change_requests TO service_role;

ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block all user access to email change requests"
ON public.email_change_requests
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS email_change_requests_user_idx
  ON public.email_change_requests (user_id, created_at DESC);

CREATE TRIGGER email_change_requests_updated_at
BEFORE UPDATE ON public.email_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();