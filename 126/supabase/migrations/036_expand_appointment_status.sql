-- Migration 036: Expand appointment status constraint and add workflow columns
--
-- Purpose: Safely expand the status CHECK constraint to include the new canonical
-- status values introduced in migration 035 (checked_in, ready, picked_up), while
-- keeping the legacy values (confirmed, completed) so that existing data and the
-- compat layer in useUpdateAppointment.ts continue to work.
--
-- Also adds the workflow timestamp columns and the is_late flag if they have not
-- already been added by migration 035.
--
-- This migration is idempotent — it is safe to apply even if migration 035 has
-- already been applied (all DDL uses IF NOT EXISTS / DROP IF EXISTS).

-- ─── Step 1: Expand the status CHECK constraint ──────────────────────────────
--
-- The original constraint (migration 007) allows only:
--   'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
--
-- We expand it to also allow the new canonical values introduced in migration 035:
--   'checked_in', 'ready', 'picked_up'
--
-- The legacy values remain so that:
--   • existing rows with 'confirmed' / 'completed' continue to be valid
--   • the compat layer in useUpdateAppointment.ts can still write those values
--     on databases where migration 035 data-migration step hasn't been run

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
    CHECK (status IN (
      -- legacy values (still accepted for backward compat)
      'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show',
      -- new canonical values introduced in migration 035
      'checked_in', 'ready', 'picked_up'
    ));

-- ─── Step 2: Add workflow timestamp columns (IF NOT EXISTS) ──────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_late            BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS in_progress_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_up_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notification_type  TEXT
    CHECK (notification_type IS NULL OR notification_type IN ('manual_heads_up', 'ready_pickup'));

-- ─── Step 3: Add appointment_notifications to business_settings (IF NOT EXISTS)

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS appointment_notifications JSONB NOT NULL DEFAULT '{
    "sms_enabled": false,
    "auto_send_ready_notification": true,
    "allow_manual_notify": true,
    "confirm_before_auto_ready": false,
    "ready_text_template": "Hi {client_name}! {pet_name} is ready for pickup at {business_name}. See you soon!",
    "manual_heads_up_template": "Hi {client_name}! Just a heads-up that {pet_name} is almost ready at {business_name}."
  }';

-- ─── Step 4: Indexes on new columns (IF NOT EXISTS) ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_appointments_is_late       ON public.appointments(is_late)        WHERE is_late = true;
CREATE INDEX IF NOT EXISTS idx_appointments_checked_in_at ON public.appointments(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_appointments_picked_up_at  ON public.appointments(picked_up_at);
