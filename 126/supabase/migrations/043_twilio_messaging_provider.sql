-- Migration 043: Twilio-backed messaging provider resources per store

CREATE TABLE IF NOT EXISTS public.message_provider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'twilio' CHECK (provider IN ('twilio')),
  account_sid TEXT,
  messaging_service_sid TEXT,
  messaging_service_name TEXT,
  provisioning_status TEXT NOT NULL DEFAULT 'not_started' CHECK (provisioning_status IN ('not_started', 'provisioning', 'action_needed', 'in_review', 'active', 'failed')),
  compliance_status TEXT NOT NULL DEFAULT 'not_started' CHECK (compliance_status IN ('not_started', 'provisioning', 'action_needed', 'in_review', 'active', 'failed')),
  sender_status TEXT NOT NULL DEFAULT 'not_started' CHECK (sender_status IN ('not_started', 'provisioning', 'action_needed', 'in_review', 'active', 'failed')),
  onboarding_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (store_id, provider)
);

CREATE TABLE IF NOT EXISTS public.message_sender_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider_profile_id UUID NOT NULL REFERENCES public.message_provider_profiles(id) ON DELETE CASCADE,
  phone_number_sid TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  sender_type TEXT NOT NULL DEFAULT 'twilio_number' CHECK (sender_type IN ('twilio_number')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'failed')),
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  country_code TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phone_number_sid),
  UNIQUE (phone_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_sender_inventory_primary_per_store
  ON public.message_sender_inventory(store_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS idx_message_provider_profiles_store_provider ON public.message_provider_profiles(store_id, provider);
CREATE INDEX IF NOT EXISTS idx_message_sender_inventory_store_primary ON public.message_sender_inventory(store_id, is_primary);

ALTER TABLE public.message_provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_sender_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view message provider profiles in their store" ON public.message_provider_profiles;
CREATE POLICY "Members can view message provider profiles in their store"
  ON public.message_provider_profiles FOR SELECT
  USING (public.is_store_member(store_id));

DROP POLICY IF EXISTS "Owners manage message provider profiles in their store" ON public.message_provider_profiles;
CREATE POLICY "Owners manage message provider profiles in their store"
  ON public.message_provider_profiles FOR ALL
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

DROP POLICY IF EXISTS "Members can view message sender inventory in their store" ON public.message_sender_inventory;
CREATE POLICY "Members can view message sender inventory in their store"
  ON public.message_sender_inventory FOR SELECT
  USING (public.is_store_member(store_id));

DROP POLICY IF EXISTS "Owners manage message sender inventory in their store" ON public.message_sender_inventory;
CREATE POLICY "Owners manage message sender inventory in their store"
  ON public.message_sender_inventory FOR ALL
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

DROP TRIGGER IF EXISTS update_message_provider_profiles_updated_at ON public.message_provider_profiles;
CREATE TRIGGER update_message_provider_profiles_updated_at
  BEFORE UPDATE ON public.message_provider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_message_sender_inventory_updated_at ON public.message_sender_inventory;
CREATE TRIGGER update_message_sender_inventory_updated_at
  BEFORE UPDATE ON public.message_sender_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
