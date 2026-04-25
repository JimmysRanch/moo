BEGIN;

ALTER TABLE public.staff_invites
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS staff_invites_token_uidx
  ON public.staff_invites(token);

COMMIT;
