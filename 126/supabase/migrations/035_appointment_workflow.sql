-- Migration 035: Appointment Workflow Overhaul
-- Purpose: Replace legacy status values with canonical workflow statuses,
--          add workflow timestamps, late flag, and notification metadata.

-- ─── Step 1: Add new columns ────────────────────────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_late            BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS in_progress_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_up_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notification_type  TEXT
    CHECK (notification_type IS NULL OR notification_type IN ('manual_heads_up', 'ready_pickup'));

-- Add appointment_notifications JSONB to business_settings for per-store SMS config
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS appointment_notifications JSONB NOT NULL DEFAULT '{
    "sms_enabled": false,
    "auto_send_ready_notification": true,
    "allow_manual_notify": true,
    "confirm_before_auto_ready": false,
    "ready_text_template": "Hi {client_name}! {pet_name} is ready for pickup at {business_name}. See you soon!",
    "manual_heads_up_template": "Hi {client_name}! Just a heads-up that {pet_name} is almost ready at {business_name}."
  }';

-- ─── Step 2: Backfill timestamps from existing status data ──────────────────

-- confirmed records → set checked_in_at from updated_at (best approximation)
UPDATE public.appointments
SET checked_in_at = updated_at
WHERE status = 'confirmed' AND checked_in_at IS NULL;

-- in_progress records → set checked_in_at and in_progress_at
UPDATE public.appointments
SET
  checked_in_at   = COALESCE(checked_in_at, updated_at),
  in_progress_at  = COALESCE(in_progress_at, updated_at)
WHERE status = 'in_progress' AND in_progress_at IS NULL;

-- completed records → set all prior timestamps and picked_up_at
UPDATE public.appointments
SET
  checked_in_at  = COALESCE(checked_in_at, updated_at),
  in_progress_at = COALESCE(in_progress_at, updated_at),
  ready_at       = COALESCE(ready_at, updated_at),
  picked_up_at   = COALESCE(picked_up_at, updated_at)
WHERE status = 'completed' AND picked_up_at IS NULL;

-- ─── Step 3: Migrate legacy status values ───────────────────────────────────

-- confirmed → checked_in
UPDATE public.appointments SET status = 'checked_in'  WHERE status = 'confirmed';
-- completed → picked_up
UPDATE public.appointments SET status = 'picked_up'   WHERE status = 'completed';
-- no_show stays no_show, cancelled stays cancelled
-- scheduled stays scheduled (appointment not yet started)
-- in_progress stays in_progress

-- ─── Step 4: Replace status CHECK constraint ────────────────────────────────

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('scheduled', 'checked_in', 'in_progress', 'ready', 'picked_up', 'cancelled', 'no_show'));

-- ─── Step 5: Update default ─────────────────────────────────────────────────

ALTER TABLE public.appointments
  ALTER COLUMN status SET DEFAULT 'scheduled';

-- ─── Step 6: Add indexes on new timestamp columns ────────────────────────────

CREATE INDEX IF NOT EXISTS idx_appointments_is_late       ON public.appointments(is_late)        WHERE is_late = true;
CREATE INDEX IF NOT EXISTS idx_appointments_checked_in_at ON public.appointments(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_appointments_picked_up_at  ON public.appointments(picked_up_at);
