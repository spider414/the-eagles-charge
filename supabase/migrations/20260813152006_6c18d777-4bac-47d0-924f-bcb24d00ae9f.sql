CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_bonus_enabled boolean NOT NULL DEFAULT true,
  registration_bonus_amount numeric NOT NULL DEFAULT 2000,
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton_chk CHECK (singleton),
  CONSTRAINT app_settings_amount_non_negative CHECK (registration_bonus_amount >= 0)
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT UPDATE, INSERT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users can read app settings" ON public.app_settings;
CREATE POLICY "Signed-in users can read app settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins update app settings" ON public.app_settings;
CREATE POLICY "Admins update app settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins insert app settings" ON public.app_settings;
CREATE POLICY "Admins insert app settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Deny delete on app settings" ON public.app_settings;
CREATE POLICY "Deny delete on app settings" ON public.app_settings
  FOR DELETE TO authenticated USING (false);

INSERT INTO public.app_settings (registration_bonus_enabled, registration_bonus_amount)
SELECT true, 2000
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_app_settings_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.admin_activity_log (actor_user_id, action, details)
  VALUES (
    auth.uid(),
    'registration_bonus_setting_changed',
    jsonb_build_object(
      'enabled_before', OLD.registration_bonus_enabled,
      'enabled_after', NEW.registration_bonus_enabled,
      'amount_before', OLD.registration_bonus_amount,
      'amount_after', NEW.registration_bonus_amount
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_settings_log_change ON public.app_settings;
CREATE TRIGGER app_settings_log_change AFTER UPDATE ON public.app_settings
FOR EACH ROW
WHEN (OLD.registration_bonus_enabled IS DISTINCT FROM NEW.registration_bonus_enabled
   OR OLD.registration_bonus_amount IS DISTINCT FROM NEW.registration_bonus_amount)
EXECUTE FUNCTION public.log_app_settings_change();

CREATE OR REPLACE FUNCTION public.grant_signup_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_enabled boolean;
  v_bonus numeric;
BEGIN
  SELECT registration_bonus_enabled, registration_bonus_amount
    INTO v_enabled, v_bonus
  FROM public.app_settings
  LIMIT 1;

  IF v_enabled IS NOT TRUE OR COALESCE(v_bonus, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  -- Never award the registration bonus twice for the same user
  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = NEW.user_id
      AND transaction_type = 'wallet_topup'
      AND description = 'Welcome bonus'
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_bonus
  WHERE id = NEW.id;

  INSERT INTO public.transactions (
    user_id, transaction_type, status, amount,
    balance_before, balance_after, description
  ) VALUES (
    NEW.user_id, 'wallet_topup', 'completed', v_bonus,
    COALESCE(NEW.wallet_balance, 0), COALESCE(NEW.wallet_balance, 0) + v_bonus,
    'Welcome bonus'
  );

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (NEW.user_id, 'Welcome bonus credited 🎉',
          'We have added ' || to_char(v_bonus, 'FM₦999,999,999.00') || ' to your wallet to get you started.', 'wallet');

  RETURN NEW;
END;
$$;