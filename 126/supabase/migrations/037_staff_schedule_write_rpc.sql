-- Migration 037: Move staff schedule writes behind validated RPCs
-- Purpose: avoid direct client-side table writes for schedule blocks and
-- ensure the target staff member belongs to the active store before mutating.

CREATE OR REPLACE FUNCTION public.create_staff_schedule_block(
  p_store_id uuid,
  p_staff_id uuid,
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_is_available boolean DEFAULT true
)
RETURNS public.staff_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule public.staff_schedules;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'permission denied for store staff schedule write' USING ERRCODE = '42501';
  END IF;

  IF p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RAISE EXCEPTION 'day_of_week must be between 0 and 6' USING ERRCODE = '22023';
  END IF;

  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'end_time must be after start_time' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.id = p_staff_id
      AND s.store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'permission denied for mismatched staff/store schedule write' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.staff_schedules (
    store_id,
    staff_id,
    day_of_week,
    start_time,
    end_time,
    is_available
  )
  VALUES (
    p_store_id,
    p_staff_id,
    p_day_of_week,
    p_start_time,
    p_end_time,
    COALESCE(p_is_available, true)
  )
  RETURNING * INTO v_schedule;

  RETURN v_schedule;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_staff_schedule_block(
  p_store_id uuid,
  p_schedule_id uuid,
  p_staff_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_store_member(p_store_id) THEN
    RAISE EXCEPTION 'permission denied for store staff schedule delete' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.id = p_staff_id
      AND s.store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'permission denied for mismatched staff/store schedule delete' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.staff_schedules
  WHERE id = p_schedule_id
    AND store_id = p_store_id
    AND staff_id = p_staff_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_staff_schedule_block(uuid, uuid, integer, time, time, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_staff_schedule_block(uuid, uuid, uuid) TO authenticated;
