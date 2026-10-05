ALTER TABLE public.jobs
  ADD COLUMN canonical_url text,
  ADD COLUMN external_reference text,
  ADD COLUMN source_provider text,
  ADD COLUMN source_record_id text,
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active','expired','blocked','private','unknown')),
  ADD COLUMN extraction_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.jobs SET canonical_url = NULLIF(job_url, ''), source_provider = source WHERE canonical_url IS NULL;
CREATE UNIQUE INDEX jobs_shared_canonical_unique ON public.jobs(canonical_url) WHERE user_id IS NULL AND canonical_url IS NOT NULL;
CREATE UNIQUE INDEX jobs_user_canonical_unique ON public.jobs(user_id, canonical_url) WHERE user_id IS NOT NULL AND canonical_url IS NOT NULL;
CREATE INDEX jobs_lifecycle_verified_idx ON public.jobs(lifecycle_status, verified_at DESC);

ALTER TABLE public.source_connections DROP CONSTRAINT source_connections_source_check;
ALTER TABLE public.source_connections ADD CONSTRAINT source_connections_source_check CHECK (source IN ('career_pages','linkedin','indeed','workday','gmail','outlook'));

CREATE TABLE public.gmail_sync_state (
  user_id uuid PRIMARY KEY,
  mailbox_email text,
  history_id text,
  watch_expiration timestamptz,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','syncing','ready','needs_attention','paused')),
  last_success_at timestamptz,
  last_notification_at timestamptz,
  last_error text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.gmail_sync_state TO service_role;
ALTER TABLE public.gmail_sync_state ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER gmail_sync_state_updated BEFORE UPDATE ON public.gmail_sync_state FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX gmail_sync_watch_expiry_idx ON public.gmail_sync_state(watch_expiration) WHERE status <> 'paused';

CREATE TABLE public.unmatched_mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gmail','outlook')),
  provider_message_id text NOT NULL,
  sender text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  received_at timestamptz,
  classification text,
  company_name text,
  job_title text,
  action_summary text,
  match_reason text,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','linked','dismissed')),
  linked_application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, provider_message_id)
);
GRANT SELECT, UPDATE, DELETE ON public.unmatched_mail_messages TO authenticated;
GRANT ALL ON public.unmatched_mail_messages TO service_role;
ALTER TABLE public.unmatched_mail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own unmatched mail read" ON public.unmatched_mail_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own unmatched mail update" ON public.unmatched_mail_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own unmatched mail delete" ON public.unmatched_mail_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER unmatched_mail_messages_updated BEFORE UPDATE ON public.unmatched_mail_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX unmatched_mail_user_review_idx ON public.unmatched_mail_messages(user_id, review_status, created_at DESC);

CREATE TABLE public.sponsor_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL,
  attachment_url text NOT NULL,
  source_updated_at timestamptz,
  checksum text NOT NULL UNIQUE,
  row_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'loading' CHECK (status IN ('loading','active','failed')),
  imported_at timestamptz,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sponsor_snapshots TO anon, authenticated;
GRANT ALL ON public.sponsor_snapshots TO service_role;
ALTER TABLE public.sponsor_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active sponsor snapshots" ON public.sponsor_snapshots FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE TRIGGER sponsor_snapshots_updated BEFORE UPDATE ON public.sponsor_snapshots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sponsor_import_rows (
  snapshot_id uuid NOT NULL REFERENCES public.sponsor_snapshots(id) ON DELETE CASCADE,
  organisation_name text NOT NULL,
  organisation_normalized text NOT NULL,
  town_city text NOT NULL DEFAULT '',
  county text NOT NULL DEFAULT '',
  type_rating text NOT NULL DEFAULT '',
  route text NOT NULL DEFAULT '',
  PRIMARY KEY (snapshot_id, organisation_name, town_city, county, type_rating, route)
);
GRANT ALL ON public.sponsor_import_rows TO service_role;
ALTER TABLE public.sponsor_import_rows ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sponsors ADD COLUMN snapshot_id uuid REFERENCES public.sponsor_snapshots(id) ON DELETE RESTRICT;
CREATE INDEX sponsors_snapshot_idx ON public.sponsors(snapshot_id);
CREATE UNIQUE INDEX sponsors_snapshot_row_unique ON public.sponsors(snapshot_id, organisation_name, town_city, county, type_rating, route) WHERE snapshot_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.activate_sponsor_snapshot(target_snapshot uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE imported integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT count(*) INTO imported FROM public.sponsor_import_rows WHERE snapshot_id = target_snapshot;
  IF imported < 50000 THEN RAISE EXCEPTION 'sponsor snapshot validation failed: only % rows', imported; END IF;
  DELETE FROM public.sponsors;
  INSERT INTO public.sponsors (organisation_name, organisation_normalized, town_city, county, type_rating, route, snapshot_id)
  SELECT organisation_name, organisation_normalized, town_city, county, type_rating, route, snapshot_id
  FROM public.sponsor_import_rows WHERE snapshot_id = target_snapshot;
  UPDATE public.sponsor_snapshots SET status = CASE WHEN id = target_snapshot THEN 'active' ELSE status END,
    imported_at = CASE WHEN id = target_snapshot THEN now() ELSE imported_at END,
    row_count = CASE WHEN id = target_snapshot THEN imported ELSE row_count END
  WHERE id = target_snapshot OR status = 'active';
  UPDATE public.sponsor_snapshots SET status = 'failed', error_summary = 'Superseded by a newer snapshot' WHERE id <> target_snapshot AND status = 'active';
  DELETE FROM public.sponsor_import_rows WHERE snapshot_id = target_snapshot;
  RETURN imported;
END $$;
REVOKE ALL ON FUNCTION public.activate_sponsor_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_sponsor_snapshot(uuid) TO service_role;

CREATE TABLE public.automation_jobs (
  job_key text PRIMARY KEY,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','paused','failed')),
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  lease_expires_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  pause_reason text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.automation_jobs TO service_role;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER automation_jobs_updated BEFORE UPDATE ON public.automation_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.claim_automation_job(target_key text, target_type text, lease_seconds integer DEFAULT 300)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE claimed boolean;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.automation_jobs(job_key, job_type) VALUES (target_key, target_type) ON CONFLICT (job_key) DO NOTHING;
  UPDATE public.automation_jobs
  SET status = 'running', lease_expires_at = now() + make_interval(secs => greatest(30, least(lease_seconds, 1800))), last_started_at = now(), last_error = null
  WHERE job_key = target_key AND status <> 'paused' AND (status <> 'running' OR lease_expires_at IS NULL OR lease_expires_at < now());
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed;
END $$;
REVOKE ALL ON FUNCTION public.claim_automation_job(text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_automation_job(text,text,integer) TO service_role;