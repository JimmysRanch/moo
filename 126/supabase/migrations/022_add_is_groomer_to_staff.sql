-- Migration 022: Add is_groomer column to staff table
-- Purpose: The staff table was missing the is_groomer column referenced by
--   the TypeScript Staff interface (useStaff.ts) and staffMapper.ts.
--   Without this column the staff UPDATE query fails with
--   "column is_groomer of relation staff does not exist".
-- Note: Renumbered from 021 to 022 so this migration sorts after
--   021_weighted_average_costing.sql. If 021_weighted_average_costing was
--   already applied, Supabase CLI would reject the original 021_ file as
--   out-of-order and the is_groomer column would never be added.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS is_groomer BOOLEAN NOT NULL DEFAULT FALSE;
