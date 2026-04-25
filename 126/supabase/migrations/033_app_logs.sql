-- Migration 033: Internal app logging
--
-- Creates:
--   • platform_admins  – one row per app-owner user; governs who can READ logs
--   • app_logs         – append-only internal log entries written by the client
--
-- After running this migration, grant yourself log access by running:
--   INSERT INTO platform_admins (user_id) VALUES ('<your-auth-user-uuid>');
--
-- Access model:
--   INSERT: any authenticated user (client-side error logging)
--   SELECT: only rows in platform_admins
--   UPDATE / DELETE: nobody via RLS (logs are append-only)

-- ── Platform admins ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- No SELECT policy → only service-role callers can query this table directly.
-- The is_platform_admin() helper below uses SECURITY DEFINER to bypass RLS.

-- ── Helper: is the current session a platform admin? ────────────────────────

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ── App logs table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_logs (
  id          BIGSERIAL    PRIMARY KEY,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  level       TEXT         NOT NULL CHECK (level IN ('error', 'warning', 'info')),
  event_type  TEXT         NOT NULL,
  message     TEXT         NOT NULL,
  details     TEXT,
  route       TEXT,
  store_id    UUID         REFERENCES public.stores(id) ON DELETE SET NULL,
  store_name  TEXT,
  user_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name   TEXT,
  metadata    JSONB
);

ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may INSERT (client-side error/fallback logging)
-- user_id must match the current session user (or be NULL) to prevent impersonation
CREATE POLICY "Authenticated users can insert app_logs"
  ON public.app_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Only platform admins may SELECT
CREATE POLICY "Platform admins can read app_logs"
  ON public.app_logs
  FOR SELECT
  USING (public.is_platform_admin());

-- Nobody may UPDATE or DELETE via the client (logs are append-only)
-- (No UPDATE/DELETE policies means those operations are denied by default.)

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS app_logs_created_at_idx ON public.app_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS app_logs_level_idx      ON public.app_logs (level);
CREATE INDEX IF NOT EXISTS app_logs_event_type_idx ON public.app_logs (event_type);
CREATE INDEX IF NOT EXISTS app_logs_store_id_idx   ON public.app_logs (store_id);
CREATE INDEX IF NOT EXISTS app_logs_user_id_idx    ON public.app_logs (user_id);
