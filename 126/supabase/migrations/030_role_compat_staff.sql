BEGIN;

ALTER TABLE public.store_memberships
  DROP CONSTRAINT IF EXISTS store_memberships_role_check;

ALTER TABLE public.store_memberships
  ADD CONSTRAINT store_memberships_role_check
  CHECK (role IN ('owner', 'manager', 'groomer', 'front_desk', 'staff', 'bather'));

ALTER TABLE public.staff_invites
  DROP CONSTRAINT IF EXISTS staff_invites_role_check;

ALTER TABLE public.staff_invites
  ADD CONSTRAINT staff_invites_role_check
  CHECK (role IN ('manager', 'groomer', 'front_desk', 'staff', 'bather'));

COMMIT;
