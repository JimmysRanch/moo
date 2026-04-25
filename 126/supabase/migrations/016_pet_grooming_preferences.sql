-- Migration 016: Add grooming preference columns to pets table
-- Purpose: Store grooming preferences directly on pets so they persist across forms

ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS overall_length TEXT;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS face_style TEXT;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS skip_ear_trim BOOLEAN DEFAULT FALSE;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS skip_tail_trim BOOLEAN DEFAULT FALSE;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS desired_style_photo TEXT;
