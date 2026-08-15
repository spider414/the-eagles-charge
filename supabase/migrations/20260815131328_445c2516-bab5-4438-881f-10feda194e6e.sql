DROP INDEX IF EXISTS public.device_registrations_fingerprint_idx;
DELETE FROM public.device_registrations a
USING public.device_registrations b
WHERE a.fingerprint = b.fingerprint AND a.ctid > b.ctid;
CREATE UNIQUE INDEX device_registrations_fingerprint_key ON public.device_registrations (fingerprint);