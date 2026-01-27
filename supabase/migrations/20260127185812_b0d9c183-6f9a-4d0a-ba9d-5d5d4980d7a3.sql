-- Create rate_limit_attempts table to track failed attempts
CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL,
  endpoint text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  locked_until timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique index for identifier + endpoint combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_identifier_endpoint 
ON public.rate_limit_attempts(identifier, endpoint);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_locked_until 
ON public.rate_limit_attempts(locked_until) WHERE locked_until IS NOT NULL;

-- Enable RLS but allow service role access only
ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Block all user access - only service role can access
CREATE POLICY "Block all user access to rate limit table" 
ON public.rate_limit_attempts 
FOR ALL 
USING (false);

-- Add trigger for updated_at
CREATE TRIGGER update_rate_limit_attempts_updated_at
BEFORE UPDATE ON public.rate_limit_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();