-- Migration 031: Add estimated duration to services for booking slot calculations

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER NOT NULL DEFAULT 60;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'services_estimated_duration_minutes_positive'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_estimated_duration_minutes_positive
      CHECK (estimated_duration_minutes > 0);
  END IF;
END
$$;
