ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS nin_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nin_number text,
  ADD COLUMN IF NOT EXISTS nin_full_name text;