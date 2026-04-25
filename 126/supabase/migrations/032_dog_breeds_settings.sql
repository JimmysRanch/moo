-- Migration 032: Dog breeds settings table
-- Purpose: Allow each store to manage the breed list used in pet forms

CREATE TABLE IF NOT EXISTS public.dog_breeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  breed_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, breed_name)
);

CREATE INDEX IF NOT EXISTS idx_dog_breeds_store_id ON public.dog_breeds(store_id);

ALTER TABLE public.dog_breeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view dog breeds in their store"
  ON public.dog_breeds FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert dog breeds in their store"
  ON public.dog_breeds FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update dog breeds in their store"
  ON public.dog_breeds FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete dog breeds in their store"
  ON public.dog_breeds FOR DELETE
  USING (public.is_store_owner(store_id));
