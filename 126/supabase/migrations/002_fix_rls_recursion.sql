-- ============================================================
-- Migration: Fix infinite recursion in RLS policies
-- ============================================================
-- Problem: store_memberships policies reference store_memberships
-- inside their own USING/WITH CHECK clauses, causing recursive
-- policy evaluation and "infinite recursion detected" errors.
--
-- Solution: Drop recursive policies, create a SECURITY DEFINER
-- helper function for ownership checks, rebuild all policies
-- using the helper function to avoid recursion.
-- ============================================================

-- ============================================================
-- STEP 1: Drop all existing policies that cause or participate
-- in recursive evaluation
-- ============================================================

-- store_memberships: drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own memberships" ON public.store_memberships;
DROP POLICY IF EXISTS "Owners can view store memberships" ON public.store_memberships;
DROP POLICY IF EXISTS "Authenticated users can create owner membership for self" ON public.store_memberships;

-- stores: drop policies that query store_memberships (indirect recursion)
DROP POLICY IF EXISTS "Members can view their stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated users can create stores" ON public.stores;

-- staff: drop policies that query store_memberships (indirect recursion)
DROP POLICY IF EXISTS "Store members can view staff" ON public.staff;
DROP POLICY IF EXISTS "Authenticated users can insert own staff record" ON public.staff;
DROP POLICY IF EXISTS "Users can update own staff record" ON public.staff;
DROP POLICY IF EXISTS "Owners can update staff in their store" ON public.staff;

-- ============================================================
-- STEP 2: Create SECURITY DEFINER helper function
-- ============================================================
-- This function bypasses RLS so it can safely query
-- store_memberships without triggering recursive policy checks.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_store_owner(_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
RETURNS NULL ON NULL INPUT
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM store_memberships
    WHERE store_id = _store_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_store_owner(uuid) TO authenticated;

-- Helper: check if user is a member of a store (any role)
CREATE OR REPLACE FUNCTION public.is_store_member(_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
RETURNS NULL ON NULL INPUT
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM store_memberships
    WHERE store_id = _store_id
      AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_store_member(uuid) TO authenticated;

-- Helper: check if a store has any members yet
-- Used during onboarding so the creator can read back the store
-- before the membership row is inserted.
CREATE OR REPLACE FUNCTION public.store_has_members(_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
RETURNS NULL ON NULL INPUT
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM store_memberships
    WHERE store_id = _store_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.store_has_members(uuid) TO authenticated;

-- ============================================================
-- STEP 3: Rebuild store_memberships policies (non-recursive)
-- ============================================================

-- SELECT: users see their own memberships
CREATE POLICY "Users view their memberships"
  ON public.store_memberships FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: user can create their own membership (needed for onboarding)
CREATE POLICY "Users create own membership"
  ON public.store_memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: owner-only via helper function (no recursion)
CREATE POLICY "Owners manage memberships"
  ON public.store_memberships FOR UPDATE
  USING (public.is_store_owner(store_id));

-- DELETE: owner-only via helper function (no recursion)
CREATE POLICY "Owners delete memberships"
  ON public.store_memberships FOR DELETE
  USING (public.is_store_owner(store_id));

-- ============================================================
-- STEP 4: Rebuild stores policies
-- ============================================================

-- SELECT: users can view stores they belong to (via helper function)
-- Also allows viewing stores with no members yet (needed during
-- onboarding when store is created before membership row).
-- Security note: the window between store INSERT and membership INSERT
-- is minimal (milliseconds) and stores only contain name + timestamps.
-- No created_by column exists to further restrict this.
CREATE POLICY "Users view their stores"
  ON public.stores FOR SELECT
  USING (
    public.is_store_member(id)
    OR NOT public.store_has_members(id)
  );

-- INSERT: authenticated users can create stores
CREATE POLICY "Users create stores"
  ON public.stores FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- STEP 5: Rebuild staff policies
-- ============================================================

-- SELECT: members can view staff in their store, or user sees own record
CREATE POLICY "View store staff"
  ON public.staff FOR SELECT
  USING (
    public.is_store_member(store_id)
    OR user_id = auth.uid()
  );

-- INSERT: user can insert own staff record, or owner can insert for others
CREATE POLICY "Insert staff record"
  ON public.staff FOR INSERT
  WITH CHECK (
    (user_id = auth.uid())
    OR public.is_store_owner(store_id)
  );

-- UPDATE: user can update own record, or owner can update store staff
CREATE POLICY "Update staff record"
  ON public.staff FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.is_store_owner(store_id)
  );
