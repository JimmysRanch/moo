-- Migration 006: Core business tables (clients, pets)
-- Purpose: Add tables for clients and their pets

-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address JSONB DEFAULT '{}',
  referral_source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create pets table
CREATE TABLE IF NOT EXISTS public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  breed TEXT,
  weight NUMERIC,
  weight_category TEXT,
  birthday DATE,
  gender TEXT,
  color TEXT,
  temperament TEXT[],
  grooming_notes TEXT,
  medical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_store_id ON public.clients(store_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pets_client_id ON public.pets(client_id);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients table
CREATE POLICY "Members can view clients in their store"
  ON public.clients FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert clients in their store"
  ON public.clients FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update clients in their store"
  ON public.clients FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete clients in their store"
  ON public.clients FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for pets table (scoped via client's store_id)
CREATE POLICY "Members can view pets of clients in their store"
  ON public.pets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = pets.client_id
      AND public.is_store_member(c.store_id)
    )
  );

CREATE POLICY "Members can insert pets for clients in their store"
  ON public.pets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = pets.client_id
      AND public.is_store_member(c.store_id)
    )
  );

CREATE POLICY "Members can update pets of clients in their store"
  ON public.pets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = pets.client_id
      AND public.is_store_member(c.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = pets.client_id
      AND public.is_store_member(c.store_id)
    )
  );

CREATE POLICY "Owners can delete pets of clients in their store"
  ON public.pets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = pets.client_id
      AND public.is_store_owner(c.store_id)
    )
  );

-- Add trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_pets_updated_at
  BEFORE UPDATE ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
