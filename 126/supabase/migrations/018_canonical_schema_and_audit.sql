-- Migration 018: Canonical schema enforcement + DB-managed auditing
-- Goal: eliminate schema drift, enforce canonical staff status, and move stamps/audit ownership into DB.

-- 1) Canonical status model for staff (status is canonical; no app fallback to is_active)
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.staff
SET status = CASE
  WHEN COALESCE(is_active, true) = false THEN 'inactive'
  ELSE 'active'
END
WHERE status IS NULL;

ALTER TABLE public.staff
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.staff
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staff_status_check'
      AND conrelid = 'public.staff'::regclass
  ) THEN
    ALTER TABLE public.staff
      ADD CONSTRAINT staff_status_check
      CHECK (status IN ('active', 'on_leave', 'inactive'));
  END IF;
END $$;

-- 2) Ensure audit stamp columns exist on audited tables
DO $$
DECLARE
  t text;
  audited_tables text[] := ARRAY[
    'staff',
    'clients',
    'pets',
    'services',
    'appointments',
    'transactions',
    'expenses',
    'payment_records',
    'inventory_items',
    'inventory_ledger',
    'payroll_settings',
    'payroll_periods'
  ];
BEGIN
  FOREACH t IN ARRAY audited_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES auth.users(id)', t);
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by UUID NULL REFERENCES auth.users(id)', t);
    END IF;
  END LOOP;
END $$;

-- 3) DB-managed stamp trigger function
CREATE OR REPLACE FUNCTION public.set_update_stamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, NOW());
    NEW.updated_at := COALESCE(NEW.updated_at, NOW());
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
    NEW.updated_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Global append-only audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  store_id UUID NULL REFERENCES public.stores(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_row JSONB NULL,
  new_row JSONB NULL,
  changed_keys TEXT[] NULL,
  request_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_store_id ON public.audit_log(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  oldj JSONB;
  newj JSONB;
  changed TEXT[];
  s_id UUID;
  rec_id TEXT;
BEGIN
  oldj := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  newj := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;

  rec_id := COALESCE(newj->>'id', oldj->>'id', '');

  IF TG_OP = 'UPDATE' THEN
    SELECT ARRAY(
      SELECT key
      FROM (
        SELECT key, value FROM jsonb_each(COALESCE(newj, '{}'::jsonb))
        UNION
        SELECT key, value FROM jsonb_each(COALESCE(oldj, '{}'::jsonb))
      ) keys
      WHERE COALESCE(newj->key, 'null'::jsonb) IS DISTINCT FROM COALESCE(oldj->key, 'null'::jsonb)
      ORDER BY key
    ) INTO changed;
  ELSE
    changed := NULL;
  END IF;

  s_id := NULL;

  IF COALESCE(newj ? 'store_id', false) THEN
    s_id := NULLIF(newj->>'store_id', '')::uuid;
  ELSIF COALESCE(oldj ? 'store_id', false) THEN
    s_id := NULLIF(oldj->>'store_id', '')::uuid;
  ELSIF TG_TABLE_NAME = 'pets' THEN
    SELECT c.store_id INTO s_id
    FROM public.clients c
    WHERE c.id = COALESCE(NULLIF(newj->>'client_id', '')::uuid, NULLIF(oldj->>'client_id', '')::uuid);
  ELSIF TG_TABLE_NAME = 'transaction_items' THEN
    SELECT t.store_id INTO s_id
    FROM public.transactions t
    WHERE t.id = COALESCE(NULLIF(newj->>'transaction_id', '')::uuid, NULLIF(oldj->>'transaction_id', '')::uuid);
  ELSIF TG_TABLE_NAME = 'appointment_services' THEN
    SELECT a.store_id INTO s_id
    FROM public.appointments a
    WHERE a.id = COALESCE(NULLIF(newj->>'appointment_id', '')::uuid, NULLIF(oldj->>'appointment_id', '')::uuid);
  END IF;

  INSERT INTO public.audit_log (
    store_id,
    table_name,
    record_id,
    action,
    actor_id,
    old_row,
    new_row,
    changed_keys,
    request_id
  ) VALUES (
    s_id,
    TG_TABLE_NAME,
    rec_id,
    TG_OP,
    auth.uid(),
    oldj,
    newj,
    changed,
    current_setting('request.headers', true)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5) Attach triggers to audited tables
DO $$
DECLARE
  t text;
  audited_tables text[] := ARRAY[
    'staff',
    'clients',
    'pets',
    'services',
    'appointments',
    'transactions',
    'expenses',
    'payment_records',
    'inventory_items',
    'inventory_ledger',
    'payroll_settings',
    'payroll_periods'
  ];
BEGIN
  FOREACH t IN ARRAY audited_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_update_stamps__%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER set_update_stamps__%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_update_stamps()', t, t);

      EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change__%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER audit_row_change__%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t, t);
    END IF;
  END LOOP;
END $$;

-- 6) Security: append-only audit log with scoped reads
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_log' AND policyname='Owners can read audit logs in their store'
  ) THEN
    CREATE POLICY "Owners can read audit logs in their store"
      ON public.audit_log FOR SELECT
      USING (store_id IS NOT NULL AND public.is_store_owner(store_id));
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM anon;
GRANT SELECT ON public.audit_log TO authenticated;

