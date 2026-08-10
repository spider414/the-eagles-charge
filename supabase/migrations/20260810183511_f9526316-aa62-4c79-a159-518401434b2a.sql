-- Admin activity log
CREATE TABLE public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  target_user_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_activity_log TO authenticated;
GRANT ALL ON public.admin_activity_log TO service_role;

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read admin activity log"
ON public.admin_activity_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Deny user insert on admin activity log"
ON public.admin_activity_log FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "Deny user update on admin activity log"
ON public.admin_activity_log FOR UPDATE TO authenticated USING (false);

CREATE POLICY "Deny user delete on admin activity log"
ON public.admin_activity_log FOR DELETE TO authenticated USING (false);

CREATE INDEX idx_admin_activity_log_created_at ON public.admin_activity_log (created_at DESC);

-- Admin read access for billing + user lookup
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all transactions"
ON public.transactions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Role management by admins (cannot change own roles)
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Deny user INSERT on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Deny user DELETE on user_roles" ON public.user_roles;

CREATE POLICY "Admins can grant roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

CREATE POLICY "Admins can revoke roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

GRANT INSERT, DELETE ON public.user_roles TO authenticated;

-- Log all role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_activity_log (actor_user_id, action, target_user_id, details)
  VALUES (
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'role_granted' ELSE 'role_revoked' END,
    CASE WHEN TG_OP = 'INSERT' THEN NEW.user_id ELSE OLD.user_id END,
    jsonb_build_object('role', CASE WHEN TG_OP = 'INSERT' THEN NEW.role ELSE OLD.role END)
  );
  RETURN CASE WHEN TG_OP = 'INSERT' THEN NEW ELSE OLD END;
END;
$$;

CREATE TRIGGER user_roles_log_insert
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_role_change();

CREATE TRIGGER user_roles_log_delete
AFTER DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_role_change();