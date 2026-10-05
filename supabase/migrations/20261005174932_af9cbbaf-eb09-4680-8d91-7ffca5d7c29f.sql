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
  DELETE FROM public.sponsors WHERE id IS NOT NULL;
  INSERT INTO public.sponsors (organisation_name, organisation_normalized, town_city, county, type_rating, route, snapshot_id)
  SELECT organisation_name, organisation_normalized, town_city, county, type_rating, route, snapshot_id
  FROM public.sponsor_import_rows WHERE snapshot_id = target_snapshot;
  UPDATE public.sponsor_snapshots SET status = 'failed', error_summary = 'Superseded by a newer snapshot' WHERE id <> target_snapshot AND status = 'active';
  UPDATE public.sponsor_snapshots SET status = 'active', imported_at = now(), row_count = imported, error_summary = null WHERE id = target_snapshot;
  DELETE FROM public.sponsor_import_rows WHERE snapshot_id = target_snapshot;
  RETURN imported;
END $$;
REVOKE ALL ON FUNCTION public.activate_sponsor_snapshot(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_sponsor_snapshot(uuid) TO service_role;