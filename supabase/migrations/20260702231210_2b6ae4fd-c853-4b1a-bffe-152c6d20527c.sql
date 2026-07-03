DROP POLICY IF EXISTS "user_roles_insert_own" ON public.user_roles;
CREATE POLICY "user_roles_insert_own_user_only" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'user'::app_role);