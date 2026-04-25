-- Migration 017: Persist pet mixed breed
-- Purpose: Ensure mixed breed selections from pet forms are stored.

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS mixed_breed TEXT;
