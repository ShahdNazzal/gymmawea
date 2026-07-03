
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.posts SET author_id = trainer_id WHERE author_id IS NULL;
ALTER TABLE public.posts ALTER COLUMN author_id SET NOT NULL;
ALTER TABLE public.posts ALTER COLUMN trainer_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);

DROP POLICY IF EXISTS "posts_manage_own" ON public.posts;
DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
CREATE POLICY "posts_select_all" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS image_url text;
CREATE INDEX IF NOT EXISTS idx_workouts_owner ON public.workouts(owner_user_id);

DROP POLICY IF EXISTS "workouts_read_all" ON public.workouts;
DROP POLICY IF EXISTS "workouts_trainer_insert" ON public.workouts;
DROP POLICY IF EXISTS "workouts_trainer_update" ON public.workouts;
DROP POLICY IF EXISTS "workouts_trainer_delete" ON public.workouts;

CREATE POLICY "workouts_select" ON public.workouts FOR SELECT TO authenticated
  USING (trainer_id IS NOT NULL OR owner_user_id IS NULL OR is_public = true OR auth.uid() = owner_user_id);
CREATE POLICY "workouts_insert" ON public.workouts FOR INSERT TO authenticated
  WITH CHECK (
    (trainer_id IS NOT NULL AND auth.uid() = trainer_id AND public.has_role(auth.uid(), 'trainer'::app_role))
    OR (owner_user_id IS NOT NULL AND auth.uid() = owner_user_id)
  );
CREATE POLICY "workouts_update" ON public.workouts FOR UPDATE TO authenticated
  USING (auth.uid() = trainer_id OR auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = trainer_id OR auth.uid() = owner_user_id);
CREATE POLICY "workouts_delete" ON public.workouts FOR DELETE TO authenticated
  USING (auth.uid() = trainer_id OR auth.uid() = owner_user_id);

ALTER TABLE public.nutrition_plans ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.nutrition_plans ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_np_owner ON public.nutrition_plans(owner_user_id);

DROP POLICY IF EXISTS "np_read_all" ON public.nutrition_plans;
DROP POLICY IF EXISTS "np_trainer_insert" ON public.nutrition_plans;
DROP POLICY IF EXISTS "np_trainer_update" ON public.nutrition_plans;
DROP POLICY IF EXISTS "np_trainer_delete" ON public.nutrition_plans;

CREATE POLICY "np_select" ON public.nutrition_plans FOR SELECT TO authenticated
  USING (trainer_id IS NOT NULL OR owner_user_id IS NULL OR is_public = true OR auth.uid() = owner_user_id);
CREATE POLICY "np_insert" ON public.nutrition_plans FOR INSERT TO authenticated
  WITH CHECK (
    (trainer_id IS NOT NULL AND auth.uid() = trainer_id AND public.has_role(auth.uid(), 'trainer'::app_role))
    OR (owner_user_id IS NOT NULL AND auth.uid() = owner_user_id)
  );
CREATE POLICY "np_update" ON public.nutrition_plans FOR UPDATE TO authenticated
  USING (auth.uid() = trainer_id OR auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = trainer_id OR auth.uid() = owner_user_id);
CREATE POLICY "np_delete" ON public.nutrition_plans FOR DELETE TO authenticated
  USING (auth.uid() = trainer_id OR auth.uid() = owner_user_id);

CREATE TABLE IF NOT EXISTS public.weekly_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  title text NOT NULL,
  workout_id uuid REFERENCES public.workouts(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ws_user ON public.weekly_schedules(user_id, day_of_week);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_schedules TO authenticated;
GRANT ALL ON public.weekly_schedules TO service_role;
ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_own" ON public.weekly_schedules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "media_read" ON storage.objects;
DROP POLICY IF EXISTS "media_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "media_update_own" ON storage.objects;
DROP POLICY IF EXISTS "media_delete_own" ON storage.objects;
CREATE POLICY "media_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'media');
CREATE POLICY "media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
