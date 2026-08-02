CREATE OR REPLACE FUNCTION public.set_unsubscribe_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.unsubscribe_token IS NULL THEN
    NEW.unsubscribe_token := encode(digest(gen_random_uuid()::text || clock_timestamp()::text, 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END;
$function$;