ALTER TABLE public.sponsor_snapshots DROP CONSTRAINT IF EXISTS sponsor_snapshots_status_check;
ALTER TABLE public.sponsor_snapshots ADD CONSTRAINT sponsor_snapshots_status_check CHECK (status IN ('loading','active','archived','failed'));
CREATE OR REPLACE FUNCTION public.activate_sponsor_snapshot(target_snapshot uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '5min' AS $function$
DECLARE imported integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT count(*) INTO imported FROM public.sponsor_import_rows WHERE snapshot_id = target_snapshot;
  IF imported < 50000 THEN RAISE EXCEPTION 'sponsor snapshot validation failed: only % rows', imported; END IF;
  UPDATE public.sponsor_snapshots SET status = 'archived' WHERE status = 'active' AND id <> target_snapshot;
  DELETE FROM public.sponsors WHERE id IS NOT NULL;
  INSERT INTO public.sponsors (organisation_name, organisation_normalized, town_city, county, type_rating, route, snapshot_id)
  SELECT organisation_name, organisation_normalized, town_city, county, type_rating, route, snapshot_id
  FROM public.sponsor_import_rows WHERE snapshot_id = target_snapshot;
  UPDATE public.sponsor_snapshots SET status = 'active', imported_at = now(), row_count = imported, error_summary = null WHERE id = target_snapshot;
  DELETE FROM public.sponsor_import_rows WHERE snapshot_id = target_snapshot;
  RETURN imported;
END $function$;