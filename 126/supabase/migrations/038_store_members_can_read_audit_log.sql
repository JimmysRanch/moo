BEGIN;

DROP POLICY IF EXISTS "Owners can read audit logs in their store" ON public.audit_log;
DROP POLICY IF EXISTS "Store members can read audit logs in their store" ON public.audit_log;

CREATE POLICY "Store members can read audit logs in their store"
  ON public.audit_log
  FOR SELECT
  USING (store_id IS NOT NULL AND public.is_store_member(store_id));

COMMIT;
