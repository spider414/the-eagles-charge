WITH stale AS (
  DELETE FROM public.transactions t
  USING public.profiles p
  WHERE p.user_id = t.user_id
    AND t.description = 'Bank transfer to virtual account'
    AND t.transaction_type = 'wallet_topup'
    AND t.status = 'completed'
    AND t.paystack_reference IS NOT NULL
    AND t.paystack_reference IN (
      '090685260122191515290545149000',
      '100033260122182500179869770909',
      '090685260123144427852152390200',
      '100004260524211519160776597753',
      '100004260524211829160776615908',
      '100004260525180958160848710132',
      '100004260525181142160847968474'
    )
  RETURNING t.user_id, t.amount
), totals AS (
  SELECT user_id, SUM(amount) AS amt FROM stale GROUP BY user_id
)
UPDATE public.profiles p
SET wallet_balance = GREATEST(COALESCE(p.wallet_balance,0) - totals.amt, 0)
FROM totals
WHERE p.user_id = totals.user_id;