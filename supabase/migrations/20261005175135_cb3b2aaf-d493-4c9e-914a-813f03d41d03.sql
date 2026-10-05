ALTER TABLE public.processed_mail_messages
  ADD COLUMN sender text NOT NULL DEFAULT '',
  ADD COLUMN subject text NOT NULL DEFAULT '',
  ADD COLUMN received_at timestamptz,
  ADD COLUMN source_kind text NOT NULL DEFAULT 'recruiter' CHECK (source_kind IN ('recruiter','linkedin_alert','indeed_alert','workday_alert','other')),
  ADD COLUMN confidence real,
  ADD COLUMN company_name text,
  ADD COLUMN job_title text,
  ADD COLUMN action_summary text,
  ADD COLUMN match_reason text,
  ADD COLUMN provider_history_id text;
CREATE INDEX processed_mail_user_source_idx ON public.processed_mail_messages(user_id, source_kind, processed_at DESC);