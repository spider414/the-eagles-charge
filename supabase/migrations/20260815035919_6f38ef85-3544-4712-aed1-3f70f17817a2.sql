ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS bonus_popup_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bonus_popup_message text,
  ADD COLUMN IF NOT EXISTS bonus_popup_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

CREATE TABLE public.popup_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  popup_key text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, popup_key, version)
);
GRANT SELECT, INSERT, DELETE ON public.popup_dismissals TO authenticated;
GRANT ALL ON public.popup_dismissals TO service_role;
ALTER TABLE public.popup_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own dismissals" ON public.popup_dismissals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.device_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  ip_address text,
  user_id uuid,
  phone_number text,
  blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  attempts integer NOT NULL DEFAULT 1,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_registrations_fingerprint_idx ON public.device_registrations (fingerprint);
CREATE INDEX device_registrations_ip_idx ON public.device_registrations (ip_address);
GRANT SELECT, UPDATE ON public.device_registrations TO authenticated;
GRANT ALL ON public.device_registrations TO service_role;
ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read device registrations" ON public.device_registrations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update device registrations" ON public.device_registrations
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER device_registrations_updated_at BEFORE UPDATE ON public.device_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.admin_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid,
  channel text NOT NULL DEFAULT 'email',
  segment text NOT NULL DEFAULT 'all',
  target_user_ids uuid[],
  template_key text,
  subject text,
  body text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_campaigns TO authenticated;
GRANT ALL ON public.admin_campaigns TO service_role;
ALTER TABLE public.admin_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read campaigns" ON public.admin_campaigns
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER admin_campaigns_updated_at BEFORE UPDATE ON public.admin_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.recovery_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  channel text,
  message text,
  amount numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recovery_actions_transaction_idx ON public.recovery_actions (transaction_id);
GRANT SELECT ON public.recovery_actions TO authenticated;
GRANT ALL ON public.recovery_actions TO service_role;
ALTER TABLE public.recovery_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read recovery actions" ON public.recovery_actions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read their own recovery actions" ON public.recovery_actions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.can_transact(_user_id uuid)
RETURNS TABLE(allowed boolean, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN p.id IS NULL THEN false
      WHEN COALESCE(p.suspended, false) THEN false
      WHEN COALESCE(p.contact_email_verified, false) IS NOT TRUE THEN false
      ELSE true
    END,
    CASE
      WHEN p.id IS NULL THEN 'profile_missing'
      WHEN COALESCE(p.suspended, false) THEN 'account_suspended'
      WHEN COALESCE(p.contact_email_verified, false) IS NOT TRUE THEN 'email_unverified'
      ELSE NULL
    END
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1;
$$;