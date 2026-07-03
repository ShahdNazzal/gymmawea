
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('user', 'trainer');
CREATE TYPE public.fitness_goal AS ENUM ('lose_weight', 'gain_muscle', 'fitness', 'tone');
CREATE TYPE public.activity_level AS ENUM ('sedentary', 'light', 'moderate', 'high');
CREATE TYPE public.equipment_type AS ENUM ('home', 'gym', 'none');
CREATE TYPE public.plan_source AS ENUM ('trainer', 'personal');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_roles_insert_own" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

-- ============ FITNESS PROFILE ============
CREATE TABLE public.user_fitness_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  height NUMERIC(5,2) NOT NULL,
  weight NUMERIC(5,2) NOT NULL,
  age INT NOT NULL,
  goal fitness_goal NOT NULL,
  activity_level activity_level NOT NULL,
  frequency INT NOT NULL,
  equipment equipment_type NOT NULL,
  injuries TEXT,
  bmi NUMERIC(5,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_fitness_profile TO authenticated;
GRANT ALL ON public.user_fitness_profile TO service_role;
ALTER TABLE public.user_fitness_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ufp_own" ON public.user_fitness_profile FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ TRAINER PROFILE ============
CREATE TABLE public.trainer_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  specialization TEXT NOT NULL,
  experience_years INT NOT NULL DEFAULT 0,
  bio TEXT,
  hero_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainer_profiles TO authenticated;
GRANT ALL ON public.trainer_profiles TO service_role;
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainer_select_all" ON public.trainer_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "trainer_manage_own" ON public.trainer_profiles FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ POSTS ============
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  likes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_all" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_manage_own" ON public.posts FOR ALL TO authenticated USING (auth.uid()=trainer_id) WITH CHECK (auth.uid()=trainer_id);

CREATE TABLE public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select_all" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_manage_own" ON public.post_likes FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ SUBSCRIPTIONS (mock) ============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, trainer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_select_related" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid()=user_id OR auth.uid()=trainer_id);
CREATE POLICY "subs_insert_own" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "subs_update_related" ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid()=user_id OR auth.uid()=trainer_id);
CREATE POLICY "subs_delete_own" ON public.subscriptions FOR DELETE TO authenticated USING (auth.uid()=user_id);

-- ============ MESSAGES ============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_select_own" ON public.messages FOR SELECT TO authenticated USING (auth.uid()=sender_id OR auth.uid()=recipient_id);
CREATE POLICY "msg_insert_own" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid()=sender_id
  AND EXISTS(
    SELECT 1 FROM public.subscriptions s
    WHERE s.status='active'
      AND ((s.user_id=auth.uid() AND s.trainer_id=recipient_id) OR (s.trainer_id=auth.uid() AND s.user_id=recipient_id))
  )
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============ WORKOUTS LIBRARY (rule-based) ============
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  goal fitness_goal NOT NULL,
  activity_level activity_level NOT NULL,
  equipment equipment_type NOT NULL,
  min_frequency INT NOT NULL DEFAULT 3,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workouts_read_all" ON public.workouts FOR SELECT TO authenticated USING (true);

-- ============ USER PERSONAL WORKOUT PLANS ============
CREATE TABLE public.user_workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_workout_plans TO authenticated;
GRANT ALL ON public.user_workout_plans TO service_role;
ALTER TABLE public.user_workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uwp_own" ON public.user_workout_plans FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ WORKOUT LOGS ============
CREATE TABLE public.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type plan_source NOT NULL,
  source_id UUID,
  exercise_name TEXT NOT NULL,
  sets INT,
  reps INT,
  weight NUMERIC(6,2),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs TO authenticated;
GRANT ALL ON public.workout_logs TO service_role;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wl_own" ON public.workout_logs FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ NUTRITION LIBRARY ============
CREATE TABLE public.nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  goal fitness_goal NOT NULL,
  min_calories INT NOT NULL,
  max_calories INT NOT NULL,
  meals JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nutrition_plans TO authenticated;
GRANT ALL ON public.nutrition_plans TO service_role;
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "np_read_all" ON public.nutrition_plans FOR SELECT TO authenticated USING (true);

-- ============ USER PERSONAL NUTRITION PLANS ============
CREATE TABLE public.user_nutrition_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  meals JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_nutrition_plans TO authenticated;
GRANT ALL ON public.user_nutrition_plans TO service_role;
ALTER TABLE public.user_nutrition_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unp_own" ON public.user_nutrition_plans FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ MEAL LOGS ============
CREATE TABLE public.meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type plan_source NOT NULL,
  source_id UUID,
  meal_name TEXT NOT NULL,
  calories INT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_logs TO authenticated;
GRANT ALL ON public.meal_logs TO service_role;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ml_own" ON public.meal_logs FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ PROGRESS LOGS ============
CREATE TABLE public.progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight NUMERIC(5,2) NOT NULL,
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_logs TO authenticated;
GRANT ALL ON public.progress_logs TO service_role;
ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_own" ON public.progress_logs FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ ACTIVE PLAN SELECTION ============
CREATE TABLE public.active_plan_selection (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_plan_type plan_source,
  workout_plan_id UUID,
  nutrition_plan_type plan_source,
  nutrition_plan_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_plan_selection TO authenticated;
GRANT ALL ON public.active_plan_selection TO service_role;
ALTER TABLE public.active_plan_selection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aps_own" ON public.active_plan_selection FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ TRAINER FAVORITES ============
CREATE TABLE public.trainer_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trainer_id)
);
GRANT SELECT, INSERT, DELETE ON public.trainer_favorites TO authenticated;
GRANT ALL ON public.trainer_favorites TO service_role;
ALTER TABLE public.trainer_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fav_own" ON public.trainer_favorites FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- ============ AUTO CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
