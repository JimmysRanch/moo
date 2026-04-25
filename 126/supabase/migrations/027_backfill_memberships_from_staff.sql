-- Migration 027: Backfill missing store_memberships from existing staff records
-- Fixes users stuck on create-store when staff exists but membership row is missing.

BEGIN;

-- Keep role values canonical in existing membership + invite rows.
UPDATE public.store_memberships SET role = 'front_desk' WHERE role = 'staff';
UPDATE public.staff_invites SET role = 'front_desk' WHERE role = 'staff';

-- Backfill memberships for staff users that are missing membership rows.
INSERT INTO public.store_memberships (store_id, user_id, role)
SELECT
  s.store_id,
  s.user_id,
  CASE
    WHEN lower(trim(coalesce(s.role, ''))) IN ('owner', 'manager', 'groomer', 'bather', 'front_desk') THEN lower(trim(s.role))
    WHEN lower(trim(coalesce(s.role, ''))) IN ('front desk', 'frontdesk', 'reception', 'receptionist', 'staff') THEN 'front_desk'
    ELSE 'front_desk'
  END AS canonical_role
FROM public.staff s
LEFT JOIN public.store_memberships sm
  ON sm.store_id = s.store_id
 AND sm.user_id = s.user_id
WHERE s.user_id IS NOT NULL
  AND sm.id IS NULL;

COMMIT;
