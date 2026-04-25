-- Migration 039: Pet soft deactivation support
-- Purpose: Add is_active and deleted_at columns to pets table so pets can be
-- deactivated (soft-deleted) instead of hard-deleted, preserving historical
-- references in appointments, reports, and payment history.

-- Add is_active column; default true so all existing pets remain active
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add deleted_at for optional archival timestamp; null means still active
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Index to make active-pet-by-client queries fast (primary operational use case)
CREATE INDEX IF NOT EXISTS idx_pets_client_id_active
  ON public.pets(client_id)
  WHERE is_active = true;
