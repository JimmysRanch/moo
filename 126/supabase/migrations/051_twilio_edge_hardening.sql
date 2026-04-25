-- Hardening for Twilio edge migration:
-- 1) fast inbound client lookup by normalized phone
-- 2) unique non-null provider_message_id safety for status callbacks

CREATE INDEX IF NOT EXISTS idx_clients_store_phone_digits
  ON public.clients (
    store_id,
    (right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10))
  );

CREATE OR REPLACE FUNCTION public.find_client_by_normalized_phone(
  p_store_id UUID,
  p_phone TEXT
)
RETURNS TABLE (client_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized_input AS (
    SELECT right(regexp_replace(coalesce(p_phone, ''), '\\D', '', 'g'), 10) AS digits
  )
  SELECT c.id AS client_id
  FROM public.clients c
  CROSS JOIN normalized_input i
  WHERE c.store_id = p_store_id
    AND right(regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g'), 10) = i.digits
  ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_client_by_normalized_phone(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_client_by_normalized_phone(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.find_client_by_normalized_phone(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.find_client_by_normalized_phone(UUID, TEXT) TO service_role;

-- Normalize existing duplicates so provider_message_id can be uniquely indexed when present.
WITH ranked AS (
  SELECT
    id,
    provider_message_id,
    row_number() OVER (
      PARTITION BY provider_message_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.messages
  WHERE provider_message_id IS NOT NULL
)
UPDATE public.messages m
SET provider_message_id = NULL
FROM ranked r
WHERE m.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_message_id_unique
  ON public.messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
