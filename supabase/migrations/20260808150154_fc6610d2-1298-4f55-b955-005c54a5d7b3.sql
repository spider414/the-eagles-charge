-- 1. Safe referral code lookup (bypasses profile RLS, returns only the referrer id)
CREATE OR REPLACE FUNCTION public.resolve_referral_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE referral_code = upper(trim(_code)) LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO anon, authenticated, service_role;

-- 2. Welcome bonus of NGN 2,000 for every new profile
CREATE OR REPLACE FUNCTION public.grant_signup_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus numeric := 2000;
BEGIN
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
          'We have added ₦2,000 to your wallet to get you started.', 'wallet');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_signup_bonus ON public.profiles;
CREATE TRIGGER on_profile_created_signup_bonus
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_signup_bonus();

-- 3. Referral bonus of NGN 1,000 on the referred user's first funded deposit
CREATE OR REPLACE FUNCTION public.award_referral_on_first_deposit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward numeric := 1000;
  v_profile public.profiles%ROWTYPE;
  v_referrer public.profiles%ROWTYPE;
BEGIN
  IF NEW.transaction_type <> 'wallet_topup' OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- Ignore the welcome bonus itself: only real funding counts
  IF COALESCE(NEW.description, '') = 'Welcome bonus' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  IF v_profile.id IS NULL OR v_profile.referred_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only once per referred user
  IF EXISTS (SELECT 1 FROM public.referral_rewards WHERE referred_id = v_profile.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_referrer FROM public.profiles WHERE id = v_profile.referred_by LIMIT 1;
  IF v_referrer.id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.referral_rewards (referrer_id, referred_id, reward_amount, transaction_id)
  VALUES (v_referrer.id, v_profile.id, v_reward, NEW.id);

  UPDATE public.profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_reward,
        total_referral_earnings = COALESCE(total_referral_earnings, 0) + v_reward
  WHERE id = v_referrer.id;

  INSERT INTO public.transactions (
    user_id, transaction_type, status, amount, description
  ) VALUES (
    v_referrer.user_id, 'wallet_topup', 'completed', v_reward, 'Referral bonus'
  );

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (v_referrer.user_id, 'Referral bonus credited 🎉',
          '₦1,000 has been added to your wallet because your referral funded their account.', 'wallet');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_transaction_referral_bonus_ins ON public.transactions;
CREATE TRIGGER on_transaction_referral_bonus_ins
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.award_referral_on_first_deposit();

DROP TRIGGER IF EXISTS on_transaction_referral_bonus_upd ON public.transactions;
CREATE TRIGGER on_transaction_referral_bonus_upd
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION public.award_referral_on_first_deposit();