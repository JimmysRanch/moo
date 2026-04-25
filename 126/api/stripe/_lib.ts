import type { VercelRequest } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";

export type Json = Record<string, unknown>;

let stripeClient: Stripe | null = null;
let sbAdmin: SupabaseClient | null = null;

export function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  stripeClient = new Stripe(key, { typescript: true });
  return stripeClient;
}

export function getSupabaseAdmin() {
  if (sbAdmin) return sbAdmin;
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  sbAdmin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return sbAdmin;
}

export function ok(data: Json = {}) {
  return { ok: true, ...data };
}

export function fail(code: string, message: string, details?: unknown) {
  return { ok: false, code, message, ...(details !== undefined ? { details } : {}) };
}

export function authHeader(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const rawHeader = Array.isArray(header) ? header[0] : header;
  const [scheme, token] = rawHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function storeIdHint(req: VercelRequest): string | undefined {
  const body = req.body as Record<string, unknown> | undefined;
  const query = req.query as Record<string, string | string[] | undefined>;
  const fromBody = typeof body?.salonId === "string" ? body.salonId : undefined;
  const fromQuery = typeof query.salonId === "string" ? query.salonId : undefined;
  const fromHeader = (req.headers["x-store-id"] as string | undefined) || (req.headers["x-salon-id"] as string | undefined);
  return fromBody ?? fromQuery ?? fromHeader;
}

export interface StoreContext {
  userId: string;
  storeId: string;
  role: string;
}

export interface TenantContext extends StoreContext {
  stripeAccountId: string;
}

export async function resolveStore(req: VercelRequest): Promise<StoreContext> {
  const token = authHeader(req);
  if (!token) throw new Error("UNAUTHORIZED: Missing Bearer token");
  const sb = getSupabaseAdmin();
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData.user) throw new Error("UNAUTHORIZED: Invalid bearer token");

  const hint = storeIdHint(req);
  let membershipQuery = sb.from("store_memberships").select("store_id, role").eq("user_id", userData.user.id).limit(10);
  if (hint) membershipQuery = membershipQuery.eq("store_id", hint);
  const { data: memberships, error: mErr } = await membershipQuery;
  if (mErr) throw mErr;
  if (!memberships?.length) throw new Error("FORBIDDEN: No store membership found");
  if (!hint && memberships.length > 1) throw new Error("MISSING_STORE_ID: Include salonId or x-store-id");

  const membership = memberships[0];
  return { userId: userData.user.id, storeId: membership.store_id, role: membership.role };
}

export function appFeeCents(totalCents: number): number {
  return Math.round(totalCents * 0.01);
}

export async function resolveTenant(req: VercelRequest): Promise<TenantContext> {
  const token = authHeader(req);
  if (!token) throw new Error("UNAUTHORIZED: Missing Bearer token");
  const sb = getSupabaseAdmin();
  const { data: userData, error: userErr } = await sb.auth.getUser(token);
  if (userErr || !userData.user) throw new Error("UNAUTHORIZED: Invalid bearer token");

  const hint = storeIdHint(req);
  let membershipQuery = sb.from("store_memberships").select("store_id, role").eq("user_id", userData.user.id).limit(10);
  if (hint) membershipQuery = membershipQuery.eq("store_id", hint);
  const { data: memberships, error: mErr } = await membershipQuery;
  if (mErr) throw mErr;
  if (!memberships?.length) throw new Error("FORBIDDEN: No store membership found");
  if (!hint && memberships.length > 1) throw new Error("MISSING_STORE_ID: Include salonId or x-store-id");

  const membership = memberships[0];
  const { data: conn, error: cErr } = await sb
    .from("stripe_connections")
    .select("stripe_account_id")
    .eq("salon_id", membership.store_id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!conn?.stripe_account_id) throw new Error("MISSING_ACCOUNT: Stripe account is not connected for store");

  return {
    userId: userData.user.id,
    storeId: membership.store_id,
    role: membership.role,
    stripeAccountId: conn.stripe_account_id,
  };
}

export async function recordWebhookEvent(eventId: string, eventType: string, payload: unknown, storeId?: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const row: Record<string, unknown> = { event_id: eventId, event_type: eventType, payload, processed_at: new Date().toISOString() };
  if (storeId) row.store_id = storeId;
  const { error } = await sb.from("webhook_events").insert(row);
  if (!error) return true;
  if ((error as { code?: string }).code === "23505") return false;
  throw error;
}

export async function upsertPaymentIntent(row: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("payment_intents").upsert(row, { onConflict: "stripe_payment_intent_id" });
  if (error) throw error;
}

export async function upsertRefund(row: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("refunds").upsert(row, { onConflict: "stripe_refund_id" });
  if (error) throw error;
}

export async function upsertStripePayout(row: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("stripe_payouts").upsert(row, { onConflict: "stripe_payout_id" });
  if (error) throw error;
}

export async function upsertStripeDispute(row: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("stripe_disputes").upsert(row, { onConflict: "stripe_dispute_id" });
  if (error) throw error;
}

export async function patchPaymentSettings(storeId: string, kind: "pos" | "card", patch: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  const { data: existing, error: readErr } = await sb
    .from("payment_settings")
    .select("settings")
    .eq("store_id", storeId)
    .eq("kind", kind)
    .maybeSingle();
  if (readErr) throw readErr;
  const settings = { ...((existing?.settings as Record<string, unknown> | undefined) ?? {}), ...patch };
  const { error } = await sb
    .from("payment_settings")
    .upsert({ store_id: storeId, kind, settings, updated_at: new Date().toISOString() }, { onConflict: "store_id,kind" });
  if (error) throw error;
  return settings;
}

export async function getPaymentSettings(storeId: string, kind: "pos" | "card") {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("payment_settings")
    .select("settings")
    .eq("store_id", storeId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  return (data?.settings as Record<string, unknown> | undefined) ?? {};
}

export async function webhookSyncTimestamp(storeId: string): Promise<string | null> {
  const sb = getSupabaseAdmin();

  // Prefer filtering by store_id column (populated for newer events)
  const { data: byColumn, error: colErr } = await sb
    .from("webhook_events")
    .select("processed_at")
    .eq("store_id", storeId)
    .order("processed_at", { ascending: false })
    .limit(1);
  if (colErr) throw colErr;
  if (byColumn?.length) return (byColumn[0] as { processed_at: string }).processed_at;

  // Fallback: scan only this store's events via payload metadata (for legacy rows without store_id).
  // This fallback may be removed once all legacy events are backfilled with store_id.
  const { data, error } = await sb
    .from("webhook_events")
    .select("processed_at, payload")
    .is("store_id", null)
    .order("processed_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  for (const row of data ?? []) {
    const payloadStoreId = (row as { payload?: { data?: { object?: { metadata?: { salonId?: string } } } } }).payload?.data?.object?.metadata?.salonId;
    if (payloadStoreId === storeId) return (row as { processed_at: string }).processed_at;
  }
  return null;
}

export function internalTxId() {
  return uuidv4();
}
