DELETE FROM public.transactions
WHERE id = '02cdcd54-6a34-48e3-9597-d52e9dc4ec52' AND status = 'pending';

UPDATE public.profiles p
SET wallet_balance = GREATEST((
  SELECT COALESCE(SUM(
    CASE WHEN t.transaction_type = 'wallet_topup' THEN t.amount ELSE -t.amount END
  ), 0)
  FROM public.transactions t
  WHERE t.user_id = p.user_id AND t.status = 'completed'
), 0)
WHERE p.user_id = 'e6f0d37c-acd3-436e-bb47-b95e9a5d2fee';