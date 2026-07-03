
-- 1. Allow trainers to create/manage their own workout & nutrition plans
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.nutrition_plans ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_workouts_trainer ON public.workouts(trainer_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_trainer ON public.nutrition_plans(trainer_id);

-- Trainers manage their own workouts
DROP POLICY IF EXISTS workouts_trainer_insert ON public.workouts;
CREATE POLICY workouts_trainer_insert ON public.workouts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = trainer_id AND public.has_role(auth.uid(), 'trainer'));

DROP POLICY IF EXISTS workouts_trainer_update ON public.workouts;
CREATE POLICY workouts_trainer_update ON public.workouts
  FOR UPDATE TO authenticated
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

DROP POLICY IF EXISTS workouts_trainer_delete ON public.workouts;
CREATE POLICY workouts_trainer_delete ON public.workouts
  FOR DELETE TO authenticated
  USING (auth.uid() = trainer_id);

-- Trainers manage their own nutrition plans
DROP POLICY IF EXISTS np_trainer_insert ON public.nutrition_plans;
CREATE POLICY np_trainer_insert ON public.nutrition_plans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = trainer_id AND public.has_role(auth.uid(), 'trainer'));

DROP POLICY IF EXISTS np_trainer_update ON public.nutrition_plans;
CREATE POLICY np_trainer_update ON public.nutrition_plans
  FOR UPDATE TO authenticated
  USING (auth.uid() = trainer_id)
  WITH CHECK (auth.uid() = trainer_id);

DROP POLICY IF EXISTS np_trainer_delete ON public.nutrition_plans;
CREATE POLICY np_trainer_delete ON public.nutrition_plans
  FOR DELETE TO authenticated
  USING (auth.uid() = trainer_id);

-- 2. Secure function to assign initial role (trainer or user) only if no role exists yet
CREATE OR REPLACE FUNCTION public.assign_initial_role(_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _role NOT IN ('user','trainer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'Role already assigned';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_initial_role(app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_initial_role(app_role) TO authenticated;
