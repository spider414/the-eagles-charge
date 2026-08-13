CREATE OR REPLACE FUNCTION public.log_app_settings_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sample numeric := 10000; -- reference deposit used to show net before/after
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