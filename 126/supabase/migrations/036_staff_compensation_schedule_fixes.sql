-- Migration 036: Align staff compensation and schedules with current UI
-- Purpose: support multi-block schedules per day and persist the full compensation form

ALTER TABLE public.staff_schedules
  DROP CONSTRAINT IF EXISTS staff_schedules_staff_id_day_of_week_key;

CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_day
  ON public.staff_schedules(staff_id, day_of_week);

ALTER TABLE public.staff_compensation
  ADD COLUMN IF NOT EXISTS salary_annual_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS weekly_guarantee_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS weekly_guarantee_payout_mode TEXT CHECK (weekly_guarantee_payout_mode IN ('both', 'higher')),
  ADD COLUMN IF NOT EXISTS team_overrides JSONB NOT NULL DEFAULT '[]'::jsonb;
