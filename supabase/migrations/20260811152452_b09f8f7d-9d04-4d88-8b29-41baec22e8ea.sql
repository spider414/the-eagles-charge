CREATE UNIQUE INDEX IF NOT EXISTS transactions_paystack_reference_uniq
ON public.transactions (paystack_reference)
WHERE paystack_reference IS NOT NULL;