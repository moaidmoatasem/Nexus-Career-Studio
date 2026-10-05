-- 1. Portal helper tasks: users may only queue the https posting link of one of their own
--    applications, and may not pre-fill the columns the helper itself writes.
DROP POLICY IF EXISTS "queue own portal tasks" ON public.portal_tasks;
CREATE POLICY "queue own portal tasks" ON public.portal_tasks FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND status = 'queued'
  AND screenshot_path IS NULL
  AND stop_reason IS NULL
  AND error IS NULL
  AND lease_expires_at IS NULL
  AND filled_fields = '[]'::jsonb
  AND portal_url ~* '^https://'
  AND EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = application_id
      AND a.user_id = auth.uid()
      AND portal_url IN (j.job_url, j.canonical_url)
  )
);

-- Private bucket the portal helper uploads screenshots to (read access is the existing
-- "read own portal screenshots" policy). Earlier migrations never created it.
INSERT INTO storage.buckets (id, name, public) VALUES ('portal-screenshots', 'portal-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Sponsor lookup: the fuzzy step now uses the pg_trgm % operator, which can use the
--    sponsors_norm_trgm GIN index, instead of computing similarity() for every register row.
--    Exact and alias steps are unchanged; results are the same rows as before.
CREATE OR REPLACE FUNCTION public.match_sponsor_company_v3(search_term text, threshold real DEFAULT 0.35, max_results integer DEFAULT 10)
RETURNS TABLE(id bigint, organisation_name text, town_city text, county text, type_rating text, route text, similarity real)
LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'extensions'
SET pg_trgm.similarity_threshold TO '0.45'
AS $function$
declare
  clean text := lower(trim(search_term));
  norm text := public.normalize_company_name(search_term);
  alias text;
begin
  alias := case clean
    when 'arm' then 'arm' when 'meta' then 'meta platforms ireland' when 'bp' then 'bp p l c'
    when 'x' then 'twitter' when 'aws' then 'amazon web' when 'bt' then 'bt'
    when 'hsbc' then 'hsbc' when 'gs' then 'goldman sachs international' when 'gds' then 'government digital'
    when 'deepmind' then 'google' when 'deep mind' then 'google' when 'google deepmind' then 'google'
    else null end;
  if alias is not null then
    return query select s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route, 1.0::real
      from sponsors s where s.organisation_normalized = alias limit max_results;
    if found then return; end if;
  end if;
  -- A search made only of words like "Ltd" or "Group" normalises to nothing; don't match on that.
  if norm = '' then return; end if;
  return query select s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route, 1.0::real
    from sponsors s where s.organisation_normalized = norm limit max_results;
  if found then return; end if;
  return query select s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route,
      extensions.similarity(s.organisation_normalized, norm) as sim
    from sponsors s
    where s.organisation_normalized % norm
      and extensions.similarity(s.organisation_normalized, norm) >= greatest(threshold, 0.45)
    order by sim desc limit max_results;
end $function$;
GRANT EXECUTE ON FUNCTION public.match_sponsor_company_v3(text, real, integer) TO anon, authenticated;
