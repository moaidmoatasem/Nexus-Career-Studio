-- Inbox safety (PLAN.md task 2.6).
-- processed_mail_messages: skipped mail keeps only its id and a reason; a message that fails
-- is retried up to three times and then skipped, so one bad message never blocks the sync.
ALTER TABLE public.processed_mail_messages
  ADD COLUMN status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed','skipped','failed')),
  ADD COLUMN attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN skip_reason text;

-- Review queue: mail from a free-mail sender, or asking for fees or visa payments, is flagged.
ALTER TABLE public.unmatched_mail_messages
  ADD COLUMN possible_scam boolean NOT NULL DEFAULT false;

-- When a sync paused because the AI provider rejected the key, so the agent can retry daily.
ALTER TABLE public.gmail_sync_state
  ADD COLUMN paused_at timestamptz;
