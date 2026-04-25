-- Migration 024: Fix roles (staff → front_desk) + enable no-login staff
-- Safe order: drop old constraints → add temporary (allow both) → migrate data → add final constraints

BEGIN;

-- ============================================================
-- 0. Add hire_date column to staff if missing
-- ============================================================
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS hire_date DATE;

-- ============================================================
-- 1. Drop existing CHECK constraints (safe: IF EXISTS)
-- ============================================================

-- store_memberships: the inline CHECK from 001_initial_schema has an auto-generated name
-- We find and drop it dynamically, but also try the common auto-name pattern.
DO $$
DECLARE
  cname text;
BEGIN
  -- Drop all check constraints on store_memberships.role
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'public.store_memberships'::regclass
      AND att.attname = 'role'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.store_memberships DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;

  -- Drop all check constraints on staff_invites.role
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'public.staff_invites'::regclass
      AND att.attname = 'role'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.staff_invites DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;

-- ============================================================
-- 2. Migrate data: staff → front_desk
-- ============================================================

UPDATE public.store_memberships SET role = 'front_desk' WHERE role = 'staff';
UPDATE public.staff_invites SET role = 'front_desk' WHERE role = 'staff';

-- ============================================================
-- 3. Add final constraints (canonical roles only)
-- ============================================================

ALTER TABLE public.store_memberships
  ADD CONSTRAINT store_memberships_role_check
  CHECK (role IN ('owner', 'manager', 'groomer', 'front_desk', 'bather'));

ALTER TABLE public.staff_invites
  ADD CONSTRAINT staff_invites_role_check
  CHECK (role IN ('manager', 'groomer', 'front_desk', 'bather'));

-- ============================================================
-- 4. Allow no-login staff (user_id nullable)
-- ============================================================

ALTER TABLE public.staff ALTER COLUMN user_id DROP NOT NULL;

-- Drop the unique constraint on (store_id, user_id) and replace with a partial unique
-- that only enforces uniqueness when user_id IS NOT NULL
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.staff'::regclass
      AND con.contype = 'u'
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = con.conrelid
          AND a.attnum = ANY(con.conkey)
          AND a.attname = 'user_id'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS staff_store_user_unique
  ON public.staff (store_id, user_id)
  WHERE user_id IS NOT NULL;

-- ============================================================
-- 5. Add updated_at to staff_invites if missing (for concurrency checks)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_invites' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.staff_invites ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- ============================================================
-- 6. Update RLS policies for staff to support no-login staff
--    Uses canonical policy names from 002_fix_rls_recursion.sql
--    and helper functions: public.is_store_owner(store_id)
-- ============================================================

-- Drop all existing staff INSERT policies (both old and canonical names)
DROP POLICY IF EXISTS "Authenticated users can insert own staff record" ON public.staff;
DROP POLICY IF EXISTS "Insert staff record" ON public.staff;

-- Recreate INSERT policy using canonical name and helper function
CREATE POLICY "Insert staff record"
  ON public.staff FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR (
        user_id IS NULL
        AND public.is_store_owner(store_id)
      )
      OR public.is_store_owner(store_id)
    )
  );

-- Drop all existing staff UPDATE policies (both old and canonical names)
DROP POLICY IF EXISTS "Users can update own staff record" ON public.staff;
DROP POLICY IF EXISTS "Update staff record" ON public.staff;

-- Recreate UPDATE policy using canonical name and helper function
CREATE POLICY "Update staff record"
  ON public.staff FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR (
        user_id IS NULL
        AND public.is_store_owner(store_id)
      )
      OR public.is_store_owner(store_id)
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR (
        user_id IS NULL
        AND public.is_store_owner(store_id)
      )
      OR public.is_store_owner(store_id)
    )
  );

COMMIT;
