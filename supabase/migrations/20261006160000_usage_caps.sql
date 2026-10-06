-- Daily usage caps (PLAN.md task 2.2): per-user counters for AI and Firecrawl calls so a public
-- instance can't burn the owner's credit. Only the server's service-role client may touch them.
CREATE TABLE public.usage_counters (
  user_id uuid NOT NULL,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ai','firecrawl')),
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind)
);
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usage_counters FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.usage_counters TO service_role;

-- Counts one call and says whether it is within p_limit. The increment is atomic: the
-- conditional upsert never lets two parallel calls both take the last slot.
CREATE OR REPLACE FUNCTION public.consume_usage(p_user uuid, p_kind text, p_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used integer;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 THEN RETURN false; END IF;
  INSERT INTO public.usage_counters AS u (user_id, day, kind, count)
  VALUES (p_user, (now() AT TIME ZONE 'utc')::date, p_kind, 1)
  ON CONFLICT (user_id, day, kind) DO UPDATE SET count = u.count + 1 WHERE u.count < p_limit
  RETURNING u.count INTO used;
  RETURN used IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.consume_usage(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_usage(uuid, text, integer) TO service_role;
