ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS balance_before numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS balance_after numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;