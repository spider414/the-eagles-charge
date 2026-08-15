CREATE TABLE IF NOT EXISTS public.admin_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope)
);

GRANT SELECT ON public.admin_scopes TO authenticated;
GRANT ALL ON public.admin_scopes TO service_role;

ALTER TABLE public.admin_scopes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_scopes WHERE user_id = _user_id AND scope = 'all');
$$;

CREATE OR REPLACE FUNCTION public.has_admin_scope(_user_id uuid, _scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') AND EXISTS (
    SELECT 1 FROM public.admin_scopes
    WHERE user_id = _user_id AND (scope = 'all' OR scope = _scope)
  );
$$;

CREATE POLICY "Admins can view their own scopes"
ON public.admin_scopes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- Existing admins become general admins
INSERT INTO public.admin_scopes (user_id, scope)
SELECT user_id, 'all' FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- First admin claim also becomes a general admin
CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.user_roles (user_id, role)
  SELECT uid, 'admin'
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  ON CONFLICT DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'admin') THEN
    INSERT INTO public.admin_scopes (user_id, scope) VALUES (uid, 'all')
    ON CONFLICT DO NOTHING;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- General admin assigns another admin to specific work areas
CREATE OR REPLACE FUNCTION public.admin_set_scopes(_user_id uuid, _scopes text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_allowed text[] := ARRAY['all','users','recovery','campaigns','email','verification','finance','logs'];
  s text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only a general admin can assign admin duties';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own admin duties';
  END IF;

  FOREACH s IN ARRAY COALESCE(_scopes, ARRAY[]::text[]) LOOP
    IF NOT (s = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'Unknown work area: %', s;
    END IF;
  END LOOP;

  DELETE FROM public.admin_scopes WHERE user_id = _user_id;

  IF _scopes IS NULL OR array_length(_scopes, 1) IS NULL THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
    INSERT INTO public.admin_activity_log (actor_user_id, action, target_user_id, details)
    VALUES (auth.uid(), 'admin_revoked', _user_id, '{}'::jsonb);
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.admin_scopes (user_id, scope)
  SELECT _user_id, unnest(_scopes)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.admin_activity_log (actor_user_id, action, target_user_id, details)
  VALUES (auth.uid(), 'admin_scopes_updated', _user_id, jsonb_build_object('scopes', _scopes));
END;
$$;