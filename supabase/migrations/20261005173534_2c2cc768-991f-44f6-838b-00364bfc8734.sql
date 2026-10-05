CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT ALL ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.processed_mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gmail')),
  provider_message_id text NOT NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  classification text,
  matched boolean NOT NULL DEFAULT false,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, provider_message_id)
);
GRANT SELECT ON public.processed_mail_messages TO authenticated;
GRANT ALL ON public.processed_mail_messages TO service_role;
ALTER TABLE public.processed_mail_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own processed mail history" ON public.processed_mail_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX app_user_connections_user_connector_idx ON public.app_user_connections(user_id, connector_id);
CREATE INDEX processed_mail_messages_user_processed_idx ON public.processed_mail_messages(user_id, processed_at DESC);

CREATE TRIGGER app_user_connections_updated BEFORE UPDATE ON public.app_user_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER processed_mail_messages_updated BEFORE UPDATE ON public.processed_mail_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();