-- 1. Live feature flags stored on the singleton app_settings row
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed sensible defaults for known toggles (kept on the existing row)
UPDATE public.app_settings
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || jsonb_build_object(
  'airtime_enabled', true,
  'data_enabled', true,
  'cable_enabled', true,
  'electricity_enabled', true,
  'internet_enabled', true,
  'exam_pin_enabled', true,
  'wallet_topup_enabled', true,
  'referrals_enabled', true,
  'support_chat_enabled', true,
  'maintenance_mode', false
)
WHERE true;

-- 2. Extend the settings audit trigger with a generic per-field change log
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
  v_key text;
  v_changed jsonb := '{}'::jsonb;
  v_old_val jsonb;
  v_new_val jsonb;
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

  -- Feature flag diff (per key)
  IF OLD.feature_flags IS DISTINCT FROM NEW.feature_flags THEN
    FOR v_key IN
      SELECT k FROM (
        SELECT jsonb_object_keys(COALESCE(OLD.feature_flags, '{}'::jsonb)) AS k
        UNION
        SELECT jsonb_object_keys(COALESCE(NEW.feature_flags, '{}'::jsonb)) AS k
      ) keys
    LOOP
      v_old_val := COALESCE(OLD.feature_flags, '{}'::jsonb) -> v_key;
      v_new_val := COALESCE(NEW.feature_flags, '{}'::jsonb) -> v_key;
      IF v_old_val IS DISTINCT FROM v_new_val THEN
        v_changed := v_changed || jsonb_build_object(
          v_key, jsonb_build_object('before', v_old_val, 'after', v_new_val)
        );
      END IF;
    END LOOP;

    IF v_changed <> '{}'::jsonb THEN
      INSERT INTO public.admin_activity_log (actor_user_id, action, details)
      VALUES (
        auth.uid(),
        'feature_flag_changed',
        jsonb_build_object('changes', v_changed)
      );
    END IF;
  END IF;

  -- Generic catch-all snapshot so every settings update is traceable
  INSERT INTO public.admin_activity_log (actor_user_id, action, details)
  VALUES (
    auth.uid(),
    'app_settings_updated',
    jsonb_build_object(
      'before', to_jsonb(OLD) - 'id' - 'created_at' - 'updated_at' - 'singleton',
      'after',  to_jsonb(NEW) - 'id' - 'created_at' - 'updated_at' - 'singleton'
    )
  );

  RETURN NEW;
END;
$function$;

-- 3. Live updates for open apps
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;