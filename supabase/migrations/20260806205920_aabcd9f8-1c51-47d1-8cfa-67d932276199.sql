CREATE TABLE public.otp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  phone_hash text NOT NULL,
  phone_hint text,
  purpose text,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.otp_audit_log TO authenticated;
GRANT ALL ON public.otp_audit_log TO service_role;

ALTER TABLE public.otp_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read otp audit log"
  ON public.otp_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny user insert on otp audit log"
  ON public.otp_audit_log FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "Deny user update on otp audit log"
  ON public.otp_audit_log FOR UPDATE TO authenticated USING (false);

CREATE POLICY "Deny user delete on otp audit log"
  ON public.otp_audit_log FOR DELETE TO authenticated USING (false);

CREATE INDEX otp_audit_log_created_at_idx ON public.otp_audit_log (created_at DESC);
CREATE INDEX otp_audit_log_phone_hash_idx ON public.otp_audit_log (phone_hash);