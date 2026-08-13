ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS deposit_fee_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deposit_fee_percent numeric NOT NULL DEFAULT 1.0;

CREATE TABLE IF NOT EXISTS public.deposit_fee_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  reference text,
  method text NOT NULL,
  gross_amount numeric NOT NULL,
  fee_percent numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL,
  balance_after numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS deposit_fee_log_reference_key ON public.deposit_fee_log (reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS deposit_fee_log_user_idx ON public.deposit_fee_log (user_id, created_at DESC);

GRANT SELECT ON public.deposit_fee_log TO authenticated;
GRANT ALL ON public.deposit_fee_log TO service_role;

ALTER TABLE public.deposit_fee_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deposit fee entries"
  ON public.deposit_fee_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all deposit fee entries"
  ON public.deposit_fee_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny user insert on deposit fee log"
  ON public.deposit_fee_log FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "Deny user update on deposit fee log"
  ON public.deposit_fee_log FOR UPDATE TO authenticated USING (false);

CREATE POLICY "Deny user delete on deposit fee log"
  ON public.deposit_fee_log FOR DELETE TO authenticated USING (false);