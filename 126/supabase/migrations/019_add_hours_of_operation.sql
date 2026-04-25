-- Migration 019: Add hours_of_operation column to business_settings
-- Purpose: Persist store hours of operation

ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS hours_of_operation JSONB DEFAULT NULL;
