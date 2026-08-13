ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS admin_notify_email text NOT NULL DEFAULT 'harmicrecharge@harmicglobal.com';