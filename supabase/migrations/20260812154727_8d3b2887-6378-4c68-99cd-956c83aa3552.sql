DELETE FROM public.user_roles WHERE role = 'admin';

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  SELECT uid, 'admin'
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  ON CONFLICT DO NOTHING;

  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'admin');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_exists() FROM public;
REVOKE ALL ON FUNCTION public.claim_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;