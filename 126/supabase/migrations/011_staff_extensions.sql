-- Migration 011: Staff extensions
-- Purpose: Add tables for staff invites, schedules, time off requests, and compensation

-- Create staff_invites table
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'groomer', 'front_desk', 'bather')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create staff_compensation table
CREATE TABLE IF NOT EXISTS public.staff_compensation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE UNIQUE,
  commission_percentage NUMERIC DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 0,
  service_commission_overrides JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create staff_schedules table
CREATE TABLE IF NOT EXISTS public.staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, day_of_week)
);

-- Create time_off_requests table
CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extend staff table with additional profile fields
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS specialties TEXT[],
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_invites_store_id ON public.staff_invites(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_email ON public.staff_invites(email);
CREATE INDEX IF NOT EXISTS idx_staff_invites_status ON public.staff_invites(status);
CREATE INDEX IF NOT EXISTS idx_staff_compensation_store_id ON public.staff_compensation(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_compensation_staff_id ON public.staff_compensation(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_store_id ON public.staff_schedules(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff_id ON public.staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_store_id ON public.time_off_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_staff_id ON public.time_off_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_status ON public.time_off_requests(status);

-- Enable RLS
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_invites
CREATE POLICY "Members can view staff invites in their store"
  ON public.staff_invites FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Owners can insert staff invites in their store"
  ON public.staff_invites FOR INSERT
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Owners can update staff invites in their store"
  ON public.staff_invites FOR UPDATE
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Owners can delete staff invites in their store"
  ON public.staff_invites FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for staff_compensation
CREATE POLICY "Members can view staff compensation in their store"
  ON public.staff_compensation FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Owners can insert staff compensation in their store"
  ON public.staff_compensation FOR INSERT
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Owners can update staff compensation in their store"
  ON public.staff_compensation FOR UPDATE
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

CREATE POLICY "Owners can delete staff compensation in their store"
  ON public.staff_compensation FOR DELETE
  USING (public.is_store_owner(store_id));

-- RLS Policies for staff_schedules
CREATE POLICY "Members can view staff schedules in their store"
  ON public.staff_schedules FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert staff schedules in their store"
  ON public.staff_schedules FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update staff schedules in their store"
  ON public.staff_schedules FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can delete staff schedules in their store"
  ON public.staff_schedules FOR DELETE
  USING (public.is_store_member(store_id));

-- RLS Policies for time_off_requests
CREATE POLICY "Members can view time off requests in their store"
  ON public.time_off_requests FOR SELECT
  USING (public.is_store_member(store_id));

CREATE POLICY "Members can insert time off requests in their store"
  ON public.time_off_requests FOR INSERT
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can update their own time off requests"
  ON public.time_off_requests FOR UPDATE
  USING (
    public.is_store_member(store_id) AND
    (
      EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = time_off_requests.staff_id
        AND s.user_id = auth.uid()
      ) OR
      public.is_store_owner(store_id)
    )
  )
  WITH CHECK (
    public.is_store_member(store_id) AND
    (
      EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = time_off_requests.staff_id
        AND s.user_id = auth.uid()
      ) OR
      public.is_store_owner(store_id)
    )
  );

CREATE POLICY "Owners can delete time off requests in their store"
  ON public.time_off_requests FOR DELETE
  USING (public.is_store_owner(store_id));

-- Add updated_at triggers
CREATE TRIGGER update_staff_compensation_updated_at
  BEFORE UPDATE ON public.staff_compensation
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_staff_schedules_updated_at
  BEFORE UPDATE ON public.staff_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
