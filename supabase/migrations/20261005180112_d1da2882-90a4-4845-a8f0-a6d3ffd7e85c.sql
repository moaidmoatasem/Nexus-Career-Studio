CREATE OR REPLACE FUNCTION public.match_sponsor_company_v3(search_term text, threshold real DEFAULT 0.35, max_results integer DEFAULT 10)
RETURNS TABLE(id bigint, organisation_name text, town_city text, county text, type_rating text, route text, similarity real)
LANGUAGE plpgsql STABLE SET search_path TO 'public', 'extensions' AS $function$
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
  return query select s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route, 1.0::real
    from sponsors s where s.organisation_normalized = norm limit max_results;
  if found then return; end if;
  return query select s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route,
      extensions.similarity(s.organisation_normalized, norm) as sim
    from sponsors s
    where extensions.similarity(s.organisation_normalized, norm) >= greatest(threshold, 0.45)
    order by sim desc limit max_results;
end $function$;