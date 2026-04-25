-- Migration 028: Restore missing memberships that can strand existing users in create-store onboarding.
--
-- Why:
-- The app determines "has a store" from public.store_memberships.
-- If a user's membership row is missing (while their staff record still exists),
-- they are incorrectly redirected to /onboarding/create-store.

BEGIN;

-- Ensure legacy role spelling is canonical.
UPDATE public.store_memberships
SET role = 'front_desk'
WHERE role = 'staff';

UPDATE public.staff
SET role = 'front_desk'
WHERE role = 'staff';

-- Rebuild missing memberships from staff rows.
-- If a staff row is marked owner, preserve owner role in membership.
INSERT INTO public.store_memberships (store_id, user_id, role)
SELECT
  s.store_id,
  s.user_id,
  CASE
    WHEN s.is_owner THEN 'owner'
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
