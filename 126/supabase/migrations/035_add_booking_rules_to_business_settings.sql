-- Migration 035: Add booking_rules column to business_settings
-- Purpose: Persist appointment booking capacity rules per store

ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS booking_rules JSONB DEFAULT NULL;
