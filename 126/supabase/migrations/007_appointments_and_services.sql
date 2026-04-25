-- Migration 007: Appointments and services configuration
-- Purpose: Add tables for appointments, services, and appointment services

-- Create services table (both main services and addons)
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL CHECK (service_type IN ('main', 'addon')),
  has_size_pricing BOOLEAN NOT NULL DEFAULT false,
  price_small NUMERIC,
  price_medium NUMERIC,
  price_large NUMERIC,
  price_giant NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  groomer_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  total_price NUMERIC NOT NULL DEFAULT 0,
  tip_amount NUMERIC DEFAULT 0,
  tip_payment_method TEXT,
  notes TEXT,
  grooming_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create appointment_services junction table
CREATE TABLE IF NOT EXISTS public.appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('main', 'addon')),
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_services_store_id ON public.services(store_id);
CREATE INDEX IF NOT EXISTS idx_services_type ON public.services(service_type);
CREATE INDEX IF NOT EXISTS idx_appointments_store_id ON public.appointments(store_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_groomer_id ON public.appointments(groomer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment_id ON public.appointment_services(appointment_id);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for services
CREATE POLICY "Members can view services in their store"
  ON public.services FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert services in their store"
  ON public.services FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update services in their store"
  ON public.services FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Owners can delete services in their store"
  ON public.services FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for appointments
CREATE POLICY "Members can view appointments in their store"
  ON public.appointments FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert appointments in their store"
  ON public.appointments FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update appointments in their store"
  ON public.appointments FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can delete appointments in their store"
  ON public.appointments FOR DELETE
  USING (public.is_store_member(store_id));

-- RLS Policies for appointment_services (scoped via appointment's store_id)
CREATE POLICY "Members can view appointment services in their store"
  ON public.appointment_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_services.appointment_id
      AND public.is_store_member(a.store_id)
    )
  );

CREATE POLICY "Members can insert appointment services in their store"
  ON public.appointment_services FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_services.appointment_id
      AND public.is_store_member(a.store_id)
    )
  );

CREATE POLICY "Members can update appointment services in their store"
  ON public.appointment_services FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_services.appointment_id
      AND public.is_store_member(a.store_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_services.appointment_id
      AND public.is_store_member(a.store_id)
    )
  );

CREATE POLICY "Members can delete appointment services in their store"
  ON public.appointment_services FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_services.appointment_id
      AND public.is_store_member(a.store_id)
    )
  );

-- Add updated_at triggers
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
