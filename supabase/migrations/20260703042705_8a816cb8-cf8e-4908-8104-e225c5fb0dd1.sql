
-- ============ email_settings (singleton) ============
CREATE TABLE public.email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name TEXT NOT NULL DEFAULT 'The Eagles Charge',
  logo_url TEXT,
  logo_emoji TEXT DEFAULT '🦅',
  primary_color TEXT NOT NULL DEFAULT '#16a34a',
  dark_color TEXT NOT NULL DEFAULT '#0f172a',
  header_tagline TEXT DEFAULT '',
  footer_text TEXT DEFAULT '',
  support_email TEXT NOT NULL DEFAULT 'support@harmicglobal.com',
  from_address TEXT NOT NULL DEFAULT 'The Eagles Charge <noreply@harmicglobal.com>',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_settings TO authenticated;
GRANT ALL ON public.email_settings TO service_role;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed-in can read email settings"
  ON public.email_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert email settings"
  ON public.email_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update email settings"
  ON public.email_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_settings_updated_at
  BEFORE UPDATE ON public.email_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_settings (brand_name) VALUES ('The Eagles Charge');

-- ============ email_templates ============
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE, -- welcome | receipt | password_reset
  subject TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  outro TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed-in can read email templates"
  ON public.email_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert email templates"
  ON public.email_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update email templates"
  ON public.email_templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_templates (template_key, subject, intro, outro) VALUES
  ('welcome',
   'Welcome to The Eagles Charge 🦅',
   'Your Eagles Charge account is ready. Buy airtime, data, pay electricity, cable, and more — instantly, at the best rates.',
   'Log in anytime and fund your wallet to get started.'),
  ('receipt',
   'Your Eagles Charge Receipt',
   'Your transaction was processed. Here''s your receipt.',
   'Keep this email as proof of payment. If anything looks off, reply within 24 hours.'),
  ('password_reset',
   'Your Eagles Charge password was reset',
   'The password for your Eagles Charge account was just reset successfully.',
   'If you did not perform this action, please contact support immediately.');

-- ============ profiles: notification preferences + unsubscribe ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_marketing_opt_in BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_promotions_opt_in BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_product_updates_opt_in BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT UNIQUE;

-- Backfill unsubscribe tokens for existing profiles
UPDATE public.profiles
SET unsubscribe_token = encode(gen_random_bytes(24), 'hex')
WHERE unsubscribe_token IS NULL;

-- Auto-generate unsubscribe_token on new profile
CREATE OR REPLACE FUNCTION public.set_unsubscribe_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.unsubscribe_token IS NULL THEN
    NEW.unsubscribe_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_unsubscribe_token ON public.profiles;
CREATE TRIGGER profiles_set_unsubscribe_token
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_unsubscribe_token();
