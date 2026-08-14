CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_profile_id uuid, p_amount numeric, p_reason text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_before numeric;
  v_after numeric;
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'Admin adjustment');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Amount must be non-zero';
  END IF;
  IF abs(p_amount) > 1000000 THEN
    RAISE EXCEPTION 'Amount exceeds the allowed limit';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_before := COALESCE(v_profile.wallet_balance, 0);
  v_after := v_before + p_amount;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient balance for this deduction';
  END IF;

  UPDATE public.profiles SET wallet_balance = v_after WHERE id = p_profile_id;

  INSERT INTO public.transactions (
    user_id, transaction_type, status, amount, balance_before, balance_after, description
  ) VALUES (
    v_profile.user_id, 'wallet_topup', 'completed', p_amount, v_before, v_after,
    'Admin adjustment: ' || v_reason
  );

  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (
    v_profile.user_id,
    CASE WHEN p_amount > 0 THEN 'Wallet credited' ELSE 'Wallet adjusted' END,
    CASE WHEN p_amount > 0
      THEN 'Your wallet was credited with ' || to_char(p_amount, 'FM₦999,999,999.00') || '. Reason: ' || v_reason
      ELSE 'Your wallet was debited by ' || to_char(abs(p_amount), 'FM₦999,999,999.00') || '. Reason: ' || v_reason
    END,
    'wallet'
  );

  INSERT INTO public.admin_activity_log (actor_user_id, action, target_user_id, details)
  VALUES (
    auth.uid(), 'wallet_adjusted', v_profile.user_id,
    jsonb_build_object('profile_id', p_profile_id, 'amount', p_amount,
      'balance_before', v_before, 'balance_after', v_after, 'reason', v_reason)
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) TO authenticated;