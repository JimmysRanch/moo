-- Migration 015: Pet photos storage bucket + table updates for store-scoped storage
-- Purpose: Add store_id to pet_photos, create storage bucket with RLS, add proper indexes
-- Also: Add updated_at to tables lacking it (staff_invites, time_off_requests) for optimistic locking

-- ============================================================
-- 1. Add store_id column to pet_photos table
-- ============================================================
ALTER TABLE public.pet_photos
  ADD COLUMN IF NOT EXISTS store_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  ADD COLUMN IF NOT EXISTS path TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Backfill store_id from pet -> client -> store relationship
UPDATE public.pet_photos pp
SET store_id = c.store_id
FROM public.pets p
JOIN public.clients c ON c.id = p.client_id
WHERE pp.pet_id = p.id
  AND pp.store_id = '00000000-0000-0000-0000-000000000000';

-- ============================================================
-- 2. Add composite index for (store_id, pet_id, created_at DESC)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pet_photos_store_pet_created
  ON public.pet_photos (store_id, pet_id, created_at DESC);

-- ============================================================
-- 3. Drop old RLS policies and recreate with direct store_id scoping
-- ============================================================
DROP POLICY IF EXISTS "Members can view pet photos of clients in their store" ON public.pet_photos;
DROP POLICY IF EXISTS "Members can insert pet photos for clients in their store" ON public.pet_photos;
DROP POLICY IF EXISTS "Members can update pet photos of clients in their store" ON public.pet_photos;
DROP POLICY IF EXISTS "Owners can delete pet photos of clients in their store" ON public.pet_photos;

CREATE POLICY "Members can view pet photos in their store"
  ON public.pet_photos FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert pet photos in their store"
  ON public.pet_photos FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update pet photos in their store"
  ON public.pet_photos FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can delete pet photos in their store"
  ON public.pet_photos FOR DELETE
  USING (public.is_store_owner(store_id));

-- ============================================================
-- 4. Create storage bucket (private, not public)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet_photos', 'pet_photos', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Storage RLS policies on storage.objects
--    Object key format: pet_photos/{store_id}/{pet_id}/{uuid}.{ext}
-- ============================================================

-- SELECT: Allow authenticated users who are store members to read objects in their store path
CREATE POLICY "Store members can read pet photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pet_photos'
    AND public.is_store_member(
      (string_to_array(name, '/'))[1]::uuid
    )
  );

-- INSERT: Allow authenticated users who are store members to upload objects in their store path
CREATE POLICY "Store members can upload pet photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pet_photos'
    AND public.is_store_member(
      (string_to_array(name, '/'))[1]::uuid
    )
  );

-- UPDATE: Allow authenticated users who are store members to update objects in their store path
CREATE POLICY "Store members can update pet photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pet_photos'
    AND public.is_store_member(
      (string_to_array(name, '/'))[1]::uuid
    )
  )
  WITH CHECK (
    bucket_id = 'pet_photos'
    AND public.is_store_member(
      (string_to_array(name, '/'))[1]::uuid
    )
  );

-- DELETE: Allow authenticated users who are store members to delete objects in their store path
CREATE POLICY "Store members can delete pet photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pet_photos'
    AND public.is_store_member(
      (string_to_array(name, '/'))[1]::uuid
    )
  );

-- ============================================================
-- 6. Add updated_at columns for optimistic locking support
-- ============================================================

-- staff_invites: add updated_at for concurrency control
ALTER TABLE public.staff_invites
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER update_staff_invites_updated_at
  BEFORE UPDATE ON public.staff_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- time_off_requests: add updated_at for concurrency control
ALTER TABLE public.time_off_requests
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER update_time_off_requests_updated_at
  BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
