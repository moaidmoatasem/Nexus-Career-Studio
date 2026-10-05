CREATE TABLE public.agent_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  autonomy text NOT NULL DEFAULT 'review_first' CHECK (autonomy IN ('review_first','guided','high_autonomy')),
  weekly_application_limit integer NOT NULL DEFAULT 10,
  min_fit_score integer NOT NULL DEFAULT 60,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.agent_settings TO authenticated;
GRANT ALL ON public.agent_settings TO service_role;
ALTER TABLE public.agent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agent settings" ON public.agent_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER agent_settings_updated BEFORE UPDATE ON public.agent_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.agent_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('succeeded','failed','needs_you','skipped')),
  summary text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  policy text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_activity_user_time ON public.agent_activity(user_id, created_at DESC);
GRANT SELECT ON public.agent_activity TO authenticated;
GRANT ALL ON public.agent_activity TO service_role;
ALTER TABLE public.agent_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own agent activity" ON public.agent_activity FOR SELECT TO authenticated USING (auth.uid() = user_id);