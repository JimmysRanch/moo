-- Migration 013: Pet photos and additional features
-- Purpose: Add table for pet photos

-- Create pet_photos table
CREATE TABLE IF NOT EXISTS public.pet_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  url TEXT,
  caption TEXT,
  is_before BOOLEAN NOT NULL DEFAULT false,
  is_after BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pet_photos_pet_id ON public.pet_photos(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_photos_uploaded_at ON public.pet_photos(uploaded_at);

-- Enable RLS
ALTER TABLE public.pet_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pet_photos (scoped via pet's client's store_id)
CREATE POLICY "Members can view pet photos of clients in their store"
  ON public.pet_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = pet_photos.pet_id
      AND public.is_store_member(c.store_id)
    )
  );

CREATE POLICY "Members can insert pet photos for clients in their store"
  ON public.pet_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pets p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = pet_photos.pet_id
      AND public.is_store_member(c.store_id)
    )
  );

CREATE POLICY "Members can update pet photos of clients in their store"
  ON public.pet_photos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = pet_photos.pet_id
      AND public.is_store_member(c.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pets p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = pet_photos.pet_id
      AND public.is_store_member(c.store_id)
    )
  );

CREATE POLICY "Owners can delete pet photos of clients in their store"
  ON public.pet_photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = pet_photos.pet_id
      AND public.is_store_owner(c.store_id)
    )
  );
