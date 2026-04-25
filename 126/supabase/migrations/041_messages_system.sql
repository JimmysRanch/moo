-- Migration 041: Messages system foundation

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS message_settings JSONB NOT NULL DEFAULT '{
    "enabled": false,
    "business_number": "",
    "number_status": "unconfigured",
    "usage": {
      "monthly_included": 500,
      "monthly_used": 0,
      "billing_cycle_anchor": null
    },
    "templates_enabled": true,
    "automations": {
      "appointment_confirmation": true,
      "appointment_reminder": true,
      "ready_for_pickup": true,
      "review_request": false,
      "missed_call_auto_text": false
    },
    "notifications": {
      "play_sound": true,
      "desktop_alerts": true,
      "mark_unread_after_hours": 12
    },
    "compliance": {
      "registration_status": "pending",
      "opt_in_copy": "By providing your number, you agree to receive appointment-related texts from our salon.",
      "help_keyword_enabled": true,
      "stop_keyword_enabled": true
    },
    "staff_permissions": {
      "allow_all_staff": true,
      "require_assignment_for_reply": false
    }
  }'::jsonb;

CREATE TABLE IF NOT EXISTS public.message_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  assigned_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  last_message_preview TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_direction TEXT CHECK (last_message_direction IS NULL OR last_message_direction IN ('inbound', 'outbound', 'system')),
  last_message_status TEXT CHECK (last_message_status IS NULL OR last_message_status IN ('draft', 'queued', 'sent', 'delivered', 'failed', 'received')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (store_id, client_id, channel)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.message_conversations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
  message_type TEXT NOT NULL DEFAULT 'sms' CHECK (message_type IN ('sms', 'system', 'template_generated')),
  body TEXT NOT NULL DEFAULT '',
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivery_status TEXT NOT NULL DEFAULT 'draft' CHECK (delivery_status IN ('draft', 'queued', 'sent', 'delivered', 'failed', 'received')),
  error_message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_automated BOOLEAN NOT NULL DEFAULT false,
  template_id UUID,
  provider_message_id TEXT,
  provider_status_raw JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  body TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE (store_id, name)
);

CREATE TABLE IF NOT EXISTS public.message_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  automation_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  send_offset_minutes INTEGER NOT NULL DEFAULT 0,
  template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, automation_key)
);

CREATE TABLE IF NOT EXISTS public.message_usage_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  included_credits INTEGER NOT NULL DEFAULT 500,
  used_credits INTEGER NOT NULL DEFAULT 0,
  overage_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, cycle_start)
);

CREATE INDEX IF NOT EXISTS idx_message_conversations_store_updated ON public.message_conversations(store_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_store_status ON public.messages(store_id, delivery_status);
CREATE INDEX IF NOT EXISTS idx_message_templates_store_order ON public.message_templates(store_id, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_message_automations_store_key ON public.message_automations(store_id, automation_key);
CREATE INDEX IF NOT EXISTS idx_message_usage_cycles_store_start ON public.message_usage_cycles(store_id, cycle_start DESC);

ALTER TABLE public.message_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_usage_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view message conversations in their store"
  ON public.message_conversations FOR SELECT
  USING (public.is_store_member(store_id));
CREATE POLICY "Members can insert message conversations in their store"
  ON public.message_conversations FOR INSERT
  WITH CHECK (public.is_store_member(store_id));
CREATE POLICY "Members can update message conversations in their store"
  ON public.message_conversations FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can view messages in their store"
  ON public.messages FOR SELECT
  USING (public.is_store_member(store_id));
CREATE POLICY "Members can insert messages in their store"
  ON public.messages FOR INSERT
  WITH CHECK (public.is_store_member(store_id));
CREATE POLICY "Members can update messages in their store"
  ON public.messages FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can view message templates in their store"
  ON public.message_templates FOR SELECT
  USING (public.is_store_member(store_id));
CREATE POLICY "Members can insert message templates in their store"
  ON public.message_templates FOR INSERT
  WITH CHECK (public.is_store_member(store_id));
CREATE POLICY "Members can update message templates in their store"
  ON public.message_templates FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));
CREATE POLICY "Owners can delete message templates in their store"
  ON public.message_templates FOR DELETE
  USING (public.is_store_owner(store_id));

CREATE POLICY "Members can view message automations in their store"
  ON public.message_automations FOR SELECT
  USING (public.is_store_member(store_id));
CREATE POLICY "Members can insert message automations in their store"
  ON public.message_automations FOR INSERT
  WITH CHECK (public.is_store_member(store_id));
CREATE POLICY "Members can update message automations in their store"
  ON public.message_automations FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE POLICY "Members can view message usage cycles in their store"
  ON public.message_usage_cycles FOR SELECT
  USING (public.is_store_member(store_id));
CREATE POLICY "Members can insert message usage cycles in their store"
  ON public.message_usage_cycles FOR INSERT
  WITH CHECK (public.is_store_member(store_id));
CREATE POLICY "Members can update message usage cycles in their store"
  ON public.message_usage_cycles FOR UPDATE
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));

CREATE TRIGGER update_message_conversations_updated_at
  BEFORE UPDATE ON public.message_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_message_automations_updated_at
  BEFORE UPDATE ON public.message_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_message_usage_cycles_updated_at
  BEFORE UPDATE ON public.message_usage_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.message_templates (store_id, name, category, body, is_system, display_order)
SELECT s.id, t.name, t.category, t.body, true, t.display_order
FROM public.stores s
CROSS JOIN (
  VALUES
    ('Appointment confirmation', 'confirmation', 'Hi {client_name}! {pet_name} is booked for {appointment_date} at {appointment_time}. Reply if you need anything before drop-off.', 0),
    ('Reminder', 'reminder', 'Friendly reminder: {pet_name} has an appointment on {appointment_date} at {appointment_time}. See you soon!', 1),
    ('Running Late', 'running_late', 'Hi {client_name}! We are running a little behind today for {pet_name}. Thanks for your patience — we will text you with the next update.', 2),
    ('Ready for Pickup', 'pickup', 'Hi {client_name}! {pet_name} is ready for pickup at {business_name}. We can''t wait to see you.', 3),
    ('Follow-up / Thank you', 'follow_up', 'Thanks for visiting us today with {pet_name}! We loved having them in. Let us know if there is anything you need before the next groom.', 4),
    ('Rebooking reminder', 'rebooking', 'It may be time to get {pet_name} back on the books. Want us to help find the next best appointment?', 5)
) AS t(name, category, body, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates existing WHERE existing.store_id = s.id AND existing.name = t.name
);
