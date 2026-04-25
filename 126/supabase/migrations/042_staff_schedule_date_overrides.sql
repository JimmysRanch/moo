-- Migration 042: Replace time-off requests with date-level staff schedule overrides
-- Purpose: store single-day attendance and availability overrides without mutating recurring schedules.

DROP TABLE IF EXISTS public.time_off_requests CASCADE;

CREATE TABLE IF NOT EXISTS public.staff_schedule_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  attendance_status TEXT CHECK (attendance_status IN ('late', 'sick_personal', 'no_call_no_show')),
  actual_arrival_time TIME,
  schedule_override_type TEXT CHECK (schedule_override_type IN ('approved_day_off', 'block_hours', 'modify_hours')),
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_schedule_overrides_staff_id_date_key UNIQUE (staff_id, override_date),
  CONSTRAINT staff_schedule_overrides_attendance_check CHECK (
    (attendance_status = 'late' AND actual_arrival_time IS NOT NULL)
    OR (attendance_status IN ('sick_personal', 'no_call_no_show') AND actual_arrival_time IS NULL)
    OR (attendance_status IS NULL AND actual_arrival_time IS NULL)
  ),
  CONSTRAINT staff_schedule_overrides_schedule_check CHECK (
    (schedule_override_type IN ('block_hours', 'modify_hours') AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
    OR (schedule_override_type = 'approved_day_off' AND start_time IS NULL AND end_time IS NULL)
    OR (schedule_override_type IS NULL AND start_time IS NULL AND end_time IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_staff_schedule_overrides_store_id
  ON public.staff_schedule_overrides(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedule_overrides_staff_date
  ON public.staff_schedule_overrides(staff_id, override_date);

ALTER TABLE public.staff_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view staff schedule overrides in their store"
  ON public.staff_schedule_overrides FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert staff schedule overrides in their store"
  ON public.staff_schedule_overrides FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update staff schedule overrides in their store"
  ON public.staff_schedule_overrides FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can delete staff schedule overrides in their store"
  ON public.staff_schedule_overrides FOR DELETE
  USING (public.is_store_member(store_id));

CREATE TRIGGER update_staff_schedule_overrides_updated_at
  BEFORE UPDATE ON public.staff_schedule_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
