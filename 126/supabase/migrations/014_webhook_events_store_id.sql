-- Add store_id column to webhook_events for tenant-scoped filtering.
-- Nullable to support legacy rows and events without store context (e.g. account.updated).
alter table public.webhook_events
  add column if not exists store_id uuid references public.stores(id) on delete cascade;

-- Index for efficient per-store lookups used by webhookSyncTimestamp()
create index if not exists idx_webhook_events_store_id on public.webhook_events(store_id);
