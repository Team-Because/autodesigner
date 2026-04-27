-- Atomic brand merge: reassigns all creatives from source brand to destination
-- brand and archives the source brand in a single transaction. Both brands
-- must be owned by the caller (or caller must be an admin).

CREATE OR REPLACE FUNCTION public.merge_brand(
  _source_brand_id uuid,
  _destination_brand_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _is_admin boolean := public.has_role(_caller, 'admin'::app_role);
  _src_owner uuid;
  _dst_owner uuid;
  _src_archived boolean;
  _moved_count integer := 0;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _source_brand_id IS NULL OR _destination_brand_id IS NULL THEN
    RAISE EXCEPTION 'Source and destination brand ids are required';
  END IF;

  IF _source_brand_id = _destination_brand_id THEN
    RAISE EXCEPTION 'Source and destination brand must be different';
  END IF;

  -- Lock both brand rows up-front to serialize concurrent merges.
  SELECT user_id, archived INTO _src_owner, _src_archived
  FROM public.brands
  WHERE id = _source_brand_id
  FOR UPDATE;

  IF _src_owner IS NULL THEN
    RAISE EXCEPTION 'Source brand not found';
  END IF;

  SELECT user_id INTO _dst_owner
  FROM public.brands
  WHERE id = _destination_brand_id
  FOR UPDATE;

  IF _dst_owner IS NULL THEN
    RAISE EXCEPTION 'Destination brand not found';
  END IF;

  IF NOT _is_admin THEN
    IF _src_owner <> _caller OR _dst_owner <> _caller THEN
      RAISE EXCEPTION 'You do not own one of these brands';
    END IF;
  END IF;

  IF _src_archived THEN
    RAISE EXCEPTION 'Source brand is already archived';
  END IF;

  -- Reassign all generations from source to destination.
  WITH moved AS (
    UPDATE public.generations
    SET brand_id = _destination_brand_id
    WHERE brand_id = _source_brand_id
    RETURNING 1
  )
  SELECT count(*) INTO _moved_count FROM moved;

  -- Archive (do not delete) the source brand to preserve history references.
  UPDATE public.brands
  SET archived = true,
      updated_at = now()
  WHERE id = _source_brand_id;

  RETURN jsonb_build_object(
    'source_brand_id', _source_brand_id,
    'destination_brand_id', _destination_brand_id,
    'creatives_transferred', _moved_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_brand(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_brand(uuid, uuid) TO authenticated;