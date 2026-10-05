CREATE TABLE public.portal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  portal_url text NOT NULL,
  adapter text NOT NULL DEFAULT 'generic',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','waiting_for_you','failed','cancelled')),
  filled_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  stop_reason text,
  screenshot_path text,
  error text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portal_tasks_queue ON public.portal_tasks(status, created_at);
GRANT SELECT, INSERT ON public.portal_tasks TO authenticated;
GRANT UPDATE (status) ON public.portal_tasks TO authenticated;
GRANT ALL ON public.portal_tasks TO service_role;
ALTER TABLE public.portal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own portal tasks" ON public.portal_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "queue own portal tasks" ON public.portal_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'queued' AND EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid()));
CREATE POLICY "cancel own portal tasks" ON public.portal_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND status = 'cancelled');
CREATE TRIGGER portal_tasks_updated BEFORE UPDATE ON public.portal_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.claim_portal_task(lease_seconds integer DEFAULT 300)
RETURNS SETOF public.portal_tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY UPDATE public.portal_tasks SET status = 'running', lease_expires_at = now() + make_interval(secs => lease_seconds)
  WHERE id = (SELECT id FROM public.portal_tasks WHERE status = 'queued' OR (status = 'running' AND lease_expires_at < now()) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_portal_task(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_portal_task(integer) TO service_role;