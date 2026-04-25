BEGIN;

ALTER TABLE public.staff_invites
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS compensation jsonb,
  ADD COLUMN IF NOT EXISTS schedules jsonb,
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_staff_invites_store_status
  ON public.staff_invites (store_id, status);

CREATE INDEX IF NOT EXISTS idx_staff_invites_expires_at
  ON public.staff_invites (expires_at);

COMMIT;
