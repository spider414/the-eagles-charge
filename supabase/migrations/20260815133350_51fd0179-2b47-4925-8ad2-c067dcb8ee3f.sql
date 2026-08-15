ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS nin_verification_required boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.nin_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  nin text NOT NULL,
  full_name text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.nin_verifications TO service_role;
ALTER TABLE public.nin_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view nin verifications"
  ON public.nin_verifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  reference text,
  amount numeric,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view payment events"
  ON public.payment_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS payment_events_reference_idx ON public.payment_events (reference);

CREATE OR REPLACE FUNCTION public.log_app_settings_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sample numeric := 10000;
  v_old_fee numeric;
  v_new_fee numeric;
BEGIN
  IF OLD.registration_bonus_enabled IS DISTINCT FROM NEW.registration_bonus_enabled
     OR OLD.registration_bonus_amount IS DISTINCT FROM NEW.registration_bonus_amount THEN
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
  END IF;

  IF OLD.nin_verification_required IS DISTINCT FROM NEW.nin_verification_required THEN
    INSERT INTO public.admin_activity_log (actor_user_id, action, details)
    VALUES (
      auth.uid(),
      'nin_verification_setting_changed',
      jsonb_build_object(
        'enabled_before', OLD.nin_verification_required,
        'enabled_after', NEW.nin_verification_required
      )
    );
  END IF;

  IF OLD.deposit_fee_enabled IS DISTINCT FROM NEW.deposit_fee_enabled
     OR OLD.deposit_fee_percent IS DISTINCT FROM NEW.deposit_fee_percent THEN
    v_old_fee := CASE WHEN OLD.deposit_fee_enabled THEN ceil(v_sample * COALESCE(OLD.deposit_fee_percent,0) / 100) ELSE 0 END;
    v_new_fee := CASE WHEN NEW.deposit_fee_enabled THEN ceil(v_sample * COALESCE(NEW.deposit_fee_percent,0) / 100) ELSE 0 END;

    INSERT INTO public.admin_activity_log (actor_user_id, action, details)
    VALUES (
      auth.uid(),
      'deposit_fee_setting_changed',
      jsonb_build_object(
        'enabled_before', OLD.deposit_fee_enabled,
        'enabled_after', NEW.deposit_fee_enabled,
        'percent_before', OLD.deposit_fee_percent,
        'percent_after', NEW.deposit_fee_percent,
        'sample_amount', v_sample,
        'fee_before', v_old_fee,
        'fee_after', v_new_fee,
        'net_before', v_sample - v_old_fee,
        'net_after', v_sample - v_new_fee
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;