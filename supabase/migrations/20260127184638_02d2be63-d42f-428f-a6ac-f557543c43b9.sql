-- Add scheduled deletion columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;

-- Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_scheduled ON public.profiles(deletion_scheduled_at) WHERE deletion_scheduled_at IS NOT NULL;