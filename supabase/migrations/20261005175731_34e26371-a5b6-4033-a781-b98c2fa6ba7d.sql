CREATE OR REPLACE FUNCTION public.match_sponsor_company_v3(search_term text, threshold real DEFAULT 0.35, max_results integer DEFAULT 10)
RETURNS TABLE(id bigint, organisation_name text, town_city text, county text, type_rating text, route text, similarity real)
LANGUAGE plpgsql STABLE SET search_path TO 'public', 'extensions' AS $function$
DECLARE
  clean text := lower(trim(search_term));
  norm text := public.normalize_company_name(search_term);
  alias text;
BEGIN
  alias := CASE clean
    WHEN 'arm' THEN 'arm' WHEN 'meta' THEN 'meta platforms ireland' WHEN 'bp' THEN 'bp p l c'
    WHEN 'x' THEN 'twitter' WHEN 'aws' THEN 'amazon web' WHEN 'bt' THEN 'bt'
    WHEN 'hsbc' THEN 'hsbc' WHEN 'gs' THEN 'goldman sachs international'
    WHEN 'gds' THEN 'government digital' WHEN 'deepmind' THEN 'google deepmind'
    WHEN 'deep mind' THEN 'google deepmind' ELSE NULL END;
  IF alias IS NOT NULL THEN
    RETURN QUERY SELECT s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route, 1.0::real
      FROM public.sponsors s WHERE s.organisation_normalized = alias OR s.organisation_normalized LIKE alias || '%'
      ORDER BY length(s.organisation_normalized), s.organisation_name LIMIT max_results;
    IF found THEN RETURN; END IF;
  END IF;
  RETURN QUERY SELECT s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route, 1.0::real
    FROM public.sponsors s WHERE s.organisation_normalized = norm LIMIT max_results;
  IF found THEN RETURN; END IF;
  RETURN QUERY SELECT s.id, s.organisation_name, s.town_city, s.county, s.type_rating, s.route,
      extensions.similarity(s.organisation_normalized, norm) AS sim
    FROM public.sponsors s
    WHERE extensions.similarity(s.organisation_normalized, norm) >= greatest(threshold, 0.45)
    ORDER BY sim DESC, length(s.organisation_normalized) LIMIT max_results;
END $function$;