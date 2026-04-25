-- Migration 042: Messages integrity, counters, and atomic usage accounting

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_template_id_fkey'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_template_id_fkey
      FOREIGN KEY (template_id)
      REFERENCES public.message_templates(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.increment_message_usage_cycle(p_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used_credits integer;
BEGIN
  UPDATE public.message_usage_cycles
  SET used_credits = used_credits + 1
  WHERE id = (
    SELECT id
    FROM public.message_usage_cycles
    WHERE store_id = p_store_id
      AND cycle_start <= CURRENT_DATE
      AND cycle_end >= CURRENT_DATE
    ORDER BY cycle_start DESC
    LIMIT 1
  )
  RETURNING used_credits INTO v_used_credits;

  RETURN v_used_credits;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_message_usage_cycle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_message_usage_cycle(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.record_inbound_message(
  p_store_id uuid,
  p_client_id uuid,
  p_appointment_id uuid,
  p_body text,
  p_provider_message_id text,
  p_payload jsonb,
  p_sent_at timestamptz
)
RETURNS TABLE (
  conversation_id uuid,
  message_id uuid,
  unread_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
  v_message_id uuid;
  v_unread_count integer;
BEGIN
  INSERT INTO public.message_conversations (
    store_id,
    client_id,
    appointment_id,
    channel,
    status,
    unread_count,
    last_message_preview,
    last_message_at,
    last_message_direction,
    last_message_status
  )
  VALUES (
    p_store_id,
    p_client_id,
    p_appointment_id,
    'sms',
    'active',
    1,
    left(coalesce(p_body, ''), 160),
    coalesce(p_sent_at, now()),
    'inbound',
    'received'
  )
  ON CONFLICT (store_id, client_id, channel)
  DO UPDATE SET
    appointment_id = coalesce(excluded.appointment_id, public.message_conversations.appointment_id),
    status = 'active',
    unread_count = public.message_conversations.unread_count + 1,
    last_message_preview = excluded.last_message_preview,
    last_message_at = excluded.last_message_at,
    last_message_direction = 'inbound',
    last_message_status = 'received'
  RETURNING id, unread_count INTO v_conversation_id, v_unread_count;

  INSERT INTO public.messages (
    store_id,
    conversation_id,
    client_id,
    appointment_id,
    direction,
    message_type,
    body,
    delivery_status,
    is_read,
    provider_message_id,
    provider_status_raw,
    sent_at
  )
  VALUES (
    p_store_id,
    v_conversation_id,
    p_client_id,
    p_appointment_id,
    'inbound',
    'sms',
    coalesce(p_body, ''),
    'received',
    false,
    p_provider_message_id,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_sent_at, now())
  )
  RETURNING id INTO v_message_id;

  conversation_id := v_conversation_id;
  message_id := v_message_id;
  unread_count := v_unread_count;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.record_inbound_message(uuid, uuid, uuid, text, text, jsonb, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_inbound_message(uuid, uuid, uuid, text, text, jsonb, timestamptz) TO service_role;
