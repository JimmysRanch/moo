-- Add notes column to refunds for optional internal free-text detail
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS notes text;
