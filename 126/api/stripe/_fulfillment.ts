import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin, upsertPaymentIntent } from "./_lib.js";

type JsonObject = Record<string, unknown>;

export interface SaleLineItem {
  id: string;
  name: string;
  type: "service" | "product" | "addon" | "other";
  quantity: number;
  price: number;
  total: number;
}

export interface StripeSaleMetadata {
  appointmentId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  petName?: string | null;
  groomerName?: string | null;
  subtotal?: number;
  taxableSubtotal?: number;
  taxAmount?: number;
  taxRate?: string | number | null;
  discount?: number;
  discountDescription?: string | null;
  additionalFees?: number;
  additionalFeesDescription?: string | null;
  totalBeforeTip?: number;
  total?: number;
  tipAmount?: number;
  tipPaymentMethod?: string | null;
  paymentMethod?: string | null;
  items?: SaleLineItem[];
  checkoutSessionId?: string | null;
  fulfillment_error?: string | null;
}

interface CheckoutSessionRecord {
  id: string;
  store_id: string;
  stripe_account_id: string;
  stripe_checkout_session_id: string;
  internal_transaction_id: string;
  success_token: string | null;
  success_token_hash: string | null;
  payment_intent_id: string | null;
  appointment_id: string | null;
  status: string;
  metadata: StripeSaleMetadata;
  finalized_at: string | null;
  fulfillment_error: string | null;
}

interface PaymentIntentRecord {
  store_id: string;
  internal_transaction_id: string | null;
  appointment_id: string | null;
  metadata: StripeSaleMetadata;
}

function isExpandedPaymentIntent(value: Stripe.Checkout.Session["payment_intent"]): value is Stripe.PaymentIntent {
  return typeof value === "object" && value !== null;
}

export function hashSuccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function safeTokenMatch(expected: string | null, incoming: string): boolean {
  if (!expected) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(incoming, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type FinalizeSaleParams = {
  paymentIntent: Stripe.PaymentIntent;
  stripeAccountId: string;
  actorUserId?: string | null;
};

export interface FinalizeSaleResult {
  finalized: boolean;
  alreadyFinalized: boolean;
  storeId: string;
  receiptId: string;
  transactionId: string | null;
  appointmentId: string | null;
  status: string;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLineItems(value: unknown): SaleLineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const source = asObject(item);
      const id = asString(source.id);
      const name = asString(source.name);
      const quantity = asNumber(source.quantity) ?? 0;
      const price = asNumber(source.price) ?? 0;
      const total = asNumber(source.total) ?? price * quantity;
      const type = asString(source.type) ?? "other";
      if (!id || !name || quantity <= 0) return null;
      return {
        id,
        name,
        type: ["service", "product", "addon", "other"].includes(type) ? (type as SaleLineItem["type"]) : "other",
        quantity,
        price,
        total,
      } satisfies SaleLineItem;
    })
    .filter((item): item is SaleLineItem => item !== null);
}

export function normalizeStripeSaleMetadata(value: unknown): StripeSaleMetadata {
  const source = asObject(value);
  return {
    appointmentId: asString(source.appointmentId),
    clientId: asString(source.clientId),
    clientName: asString(source.clientName),
    petName: asString(source.petName),
    groomerName: asString(source.groomerName),
    subtotal: asNumber(source.subtotal) ?? undefined,
    taxableSubtotal: asNumber(source.taxableSubtotal) ?? undefined,
    taxAmount: asNumber(source.taxAmount) ?? undefined,
    taxRate: source.taxRate === null || source.taxRate === undefined ? null : (typeof source.taxRate === "string" || typeof source.taxRate === "number" ? source.taxRate : null),
    discount: asNumber(source.discount) ?? undefined,
    discountDescription: asString(source.discountDescription),
    additionalFees: asNumber(source.additionalFees) ?? undefined,
    additionalFeesDescription: asString(source.additionalFeesDescription),
    totalBeforeTip: asNumber(source.totalBeforeTip) ?? undefined,
    total: asNumber(source.total) ?? undefined,
    tipAmount: asNumber(source.tipAmount) ?? undefined,
    tipPaymentMethod: asString(source.tipPaymentMethod),
    paymentMethod: asString(source.paymentMethod),
    items: normalizeLineItems(source.items),
    checkoutSessionId: asString(source.checkoutSessionId),
  };
}

async function getCheckoutSessionRecordByInternalTx(internalTransactionId: string | null | undefined) {
  if (!internalTransactionId) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("stripe_checkout_sessions")
    .select("*")
    .eq("internal_transaction_id", internalTransactionId)
    .maybeSingle();
  if (error) throw error;
  return (data as CheckoutSessionRecord | null) ?? null;
}

async function getCheckoutSessionRecordBySessionId(sessionId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("stripe_checkout_sessions")
    .select("*")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data as CheckoutSessionRecord | null) ?? null;
}

async function getPaymentIntentRecord(paymentIntentId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("payment_intents")
    .select("store_id, internal_transaction_id, appointment_id, metadata")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) throw error;
  return (data as PaymentIntentRecord | null) ?? null;
}

async function getExistingFinalizedTransaction(sb: SupabaseClient, storeId: string, paymentIntentId: string) {
  const { data, error } = await sb
    .from("transactions")
    .select("id, appointment_id")
    .eq("store_id", storeId)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string; appointment_id: string | null } | null) ?? null;
}

async function ensurePaymentIntentProjection(
  sb: SupabaseClient,
  paymentIntent: Stripe.PaymentIntent,
  storeId: string,
  metadata: StripeSaleMetadata,
  internalTransactionId: string | null,
) {
  await upsertPaymentIntent({
    internal_transaction_id: internalTransactionId,
    stripe_payment_intent_id: paymentIntent.id,
    stripe_charge_id: typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : null,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    payment_method: metadata.paymentMethod ?? paymentIntent.payment_method_types?.[0] ?? "card",
    store_id: storeId,
    appointment_id: metadata.appointmentId ?? null,
    metadata,
    updated_at: new Date().toISOString(),
  });

  const checkoutSessionId = metadata.checkoutSessionId;
  if (checkoutSessionId) {
    const { error } = await sb
      .from("stripe_checkout_sessions")
      .update({
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status === "succeeded" ? "paid" : "open",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_checkout_session_id", checkoutSessionId);
    if (error) throw error;
  }
}

async function insertTransaction(
  sb: SupabaseClient,
  storeId: string,
  paymentIntent: Stripe.PaymentIntent,
  metadata: StripeSaleMetadata,
  actorUserId?: string | null,
) {
  const now = new Date().toISOString();
  const row = {
    store_id: storeId,
    appointment_id: metadata.appointmentId ?? null,
    client_id: metadata.clientId ?? null,
    date: now.slice(0, 10),
    subtotal: metadata.subtotal ?? metadata.totalBeforeTip ?? paymentIntent.amount / 100,
    discount: metadata.discount ?? 0,
    discount_description: metadata.discountDescription ?? null,
    additional_fees: metadata.additionalFees ?? 0,
    additional_fees_description: metadata.additionalFeesDescription ?? null,
    total: metadata.total ?? paymentIntent.amount / 100,
    tip_amount: metadata.tipAmount ?? 0,
    tip_payment_method: metadata.tipPaymentMethod ?? null,
    payment_method: metadata.paymentMethod ?? paymentIntent.payment_method_types?.[0] ?? "card",
    status: "completed",
    type: "sale",
    stripe_payment_intent_id: paymentIntent.id,
    notes: metadata.items?.map((item) => item.name).join(", ") || null,
    created_by: actorUserId ?? null,
    updated_at: now,
    updated_by: actorUserId ?? null,
  };

  // Use upsert by the unique index on stripe_payment_intent_id to keep inserts idempotent
  // even if two concurrent callers race (e.g. webhook + client finalize).
  const { data, error } = await sb
    .from("transactions")
    .upsert(row, { onConflict: "stripe_payment_intent_id", ignoreDuplicates: false })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function insertTransactionItemsIfMissing(
  sb: SupabaseClient,
  transactionId: string,
  items: SaleLineItem[],
) {
  if (items.length === 0) return;
  const { data: existing, error: readErr } = await sb
    .from("transaction_items")
    .select("id")
    .eq("transaction_id", transactionId)
    .limit(1);
  if (readErr) throw readErr;
  if (existing && existing.length > 0) return;

  const { error } = await sb.from("transaction_items").insert(
    items.map((item) => ({
      transaction_id: transactionId,
      item_name: item.name,
      item_type: item.type,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
    })),
  );
  if (error) throw error;
}

async function markAppointmentPickedUpIfPending(
  sb: SupabaseClient,
  storeId: string,
  metadata: StripeSaleMetadata,
) {
  if (!metadata.appointmentId) return;
  const { data: existing, error: readErr } = await sb
    .from("appointments")
    .select("status, picked_up_at")
    .eq("store_id", storeId)
    .eq("id", metadata.appointmentId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing?.picked_up_at || existing?.status === "picked_up") return;

  const { error } = await sb
    .from("appointments")
    .update({
      status: "picked_up",
      picked_up_at: new Date().toISOString(),
      tip_amount: metadata.tipAmount ?? 0,
      tip_payment_method: metadata.tipPaymentMethod ?? null,
    })
    .eq("store_id", storeId)
    .eq("id", metadata.appointmentId);
  if (error) throw error;
}

async function finalizeInventory(
  sb: SupabaseClient,
  storeId: string,
  paymentIntentId: string,
  items: SaleLineItem[],
  actorUserId?: string | null,
) {
  const productItems = items.filter((item) => item.type === "product");
  for (const item of productItems) {
    const { data: existing, error: existingError } = await sb
      .from("inventory_ledger")
      .select("id")
      .eq("store_id", storeId)
      .eq("item_id", item.id)
      .eq("reference_type", "sale")
      .eq("reference_id", paymentIntentId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.id) continue;

    const { error } = await sb.rpc("record_inventory_sale", {
      p_store_id: storeId,
      p_item_id: item.id,
      p_qty: item.quantity,
      p_reference_type: "sale",
      p_reference_id: paymentIntentId,
      p_notes: `PI #${paymentIntentId.slice(-6)}`,
      p_user_id: actorUserId ?? null,
    });
    if (error) throw error;
  }
}

async function deriveSaleContext(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentRecord = await getPaymentIntentRecord(paymentIntent.id);
  const internalTransactionId = paymentIntentRecord?.internal_transaction_id ?? paymentIntent.metadata?.internalTransactionId ?? null;
  const checkoutRecord = await getCheckoutSessionRecordByInternalTx(internalTransactionId);
  const metadata = normalizeStripeSaleMetadata(
    paymentIntentRecord?.metadata && Object.keys(paymentIntentRecord.metadata).length > 0
      ? paymentIntentRecord.metadata
      : checkoutRecord?.metadata,
  );
  return {
    storeId: paymentIntentRecord?.store_id ?? checkoutRecord?.store_id ?? paymentIntent.metadata?.salonId ?? null,
    metadata: {
      ...metadata,
      appointmentId: metadata.appointmentId ?? paymentIntentRecord?.appointment_id ?? checkoutRecord?.appointment_id ?? null,
      checkoutSessionId: metadata.checkoutSessionId ?? checkoutRecord?.stripe_checkout_session_id ?? null,
    } satisfies StripeSaleMetadata,
    internalTransactionId,
    checkoutRecord,
  };
}

const FULFILLMENT_CLAIM_STALE_MS = 5 * 60 * 1000;

function newClaimId(): string {
  // Node's webcrypto is available in the Vercel runtime.
  return (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function tryClaimFulfillment(
  sb: SupabaseClient,
  paymentIntentId: string,
): Promise<{ status: "claimed" | "finalized" | "in_progress"; claimId: string | null }> {
  const claimId = newClaimId();
  const nowIso = new Date().toISOString();
  const staleBefore = new Date(Date.now() - FULFILLMENT_CLAIM_STALE_MS).toISOString();

  // Atomic claim: only one caller can flip the row from (null|failed|stale-finalizing)
  // into 'finalizing' with our claimId. `.select()` returns the updated rows.
  const { data: claimed, error: claimErr } = await sb
    .from("payment_intents")
    .update({
      fulfillment_status: "finalizing",
      fulfillment_claim_id: claimId,
      fulfillment_claimed_at: nowIso,
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .or(`fulfillment_status.is.null,fulfillment_status.eq.failed,and(fulfillment_status.eq.finalizing,fulfillment_claimed_at.lt.${staleBefore})`)
    .select("fulfillment_claim_id");
  if (claimErr) throw claimErr;
  if (claimed && claimed.length > 0) {
    return { status: "claimed", claimId };
  }

  // We did not win the claim. Inspect the current state.
  const { data: current, error: readErr } = await sb
    .from("payment_intents")
    .select("fulfillment_status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (readErr) throw readErr;
  const status = (current?.fulfillment_status as string | null) ?? null;
  if (status === "finalized") return { status: "finalized", claimId: null };
  return { status: "in_progress", claimId: null };
}

async function releaseFulfillmentClaim(
  sb: SupabaseClient,
  paymentIntentId: string,
  claimId: string,
  finalStatus: "finalized" | "failed",
  errorMessage?: string | null,
) {
  const patch: Record<string, unknown> = {
    fulfillment_status: finalStatus,
  };
  if (finalStatus === "finalized") {
    patch.fulfillment_finalized_at = new Date().toISOString();
  }
  const { error } = await sb
    .from("payment_intents")
    .update(patch)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("fulfillment_claim_id", claimId);
  if (error) throw error;

  if (finalStatus === "failed" && errorMessage) {
    const { data: row } = await sb
      .from("payment_intents")
      .select("metadata")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();
    const metadata = { ...((row?.metadata as Record<string, unknown> | undefined) ?? {}), fulfillment_error: errorMessage };
    await sb
      .from("payment_intents")
      .update({ metadata })
      .eq("stripe_payment_intent_id", paymentIntentId);
  }
}

export async function finalizePaymentIntentSale({
  paymentIntent,
  stripeAccountId,
  actorUserId = null,
}: FinalizeSaleParams): Promise<FinalizeSaleResult> {
  const sb = getSupabaseAdmin();
  const { storeId, metadata, internalTransactionId, checkoutRecord } = await deriveSaleContext(paymentIntent);
  if (!storeId) {
    throw new Error("MISSING_STORE_ID: Unable to determine store for Stripe sale");
  }

  // Always project the latest payment-intent state, regardless of status. This
  // also guarantees a row exists so the atomic claim below has something to
  // update.
  await ensurePaymentIntentProjection(sb, paymentIntent, storeId, metadata, internalTransactionId);

  // `requires_capture` is an authorization only — no completed sale yet, and we
  // do NOT claim finalization or run any side effects.
  if (paymentIntent.status === "requires_capture") {
    return {
      finalized: false,
      alreadyFinalized: false,
      storeId,
      receiptId: paymentIntent.id,
      transactionId: null,
      appointmentId: metadata.appointmentId ?? null,
      status: paymentIntent.status,
    };
  }

  if (paymentIntent.status !== "succeeded") {
    throw new Error(`PAYMENT_NOT_READY: ${paymentIntent.status}`);
  }

  // Fast-path idempotency check: if a transaction already exists for this PI
  // (unique index guarantees at most one) or the checkout session is already
  // finalized, short-circuit without attempting a claim.
  const existingTransaction = await getExistingFinalizedTransaction(sb, storeId, paymentIntent.id);
  const alreadyFinalizedByCheckout = Boolean(checkoutRecord?.finalized_at);
  if (existingTransaction?.id || alreadyFinalizedByCheckout) {
    return {
      finalized: true,
      alreadyFinalized: true,
      storeId,
      receiptId: paymentIntent.id,
      transactionId: existingTransaction?.id ?? null,
      appointmentId: existingTransaction?.appointment_id ?? metadata.appointmentId ?? null,
      status: paymentIntent.status,
    };
  }

  // Atomic claim on payment_intents. If we don't win the claim, another caller
  // is already running (or has run) the side effects — do NOT run them again.
  const claim = await tryClaimFulfillment(sb, paymentIntent.id);
  if (claim.status !== "claimed") {
    const finalExisting = await getExistingFinalizedTransaction(sb, storeId, paymentIntent.id);
    return {
      finalized: claim.status === "finalized" || Boolean(finalExisting?.id),
      alreadyFinalized: true,
      storeId,
      receiptId: paymentIntent.id,
      transactionId: finalExisting?.id ?? null,
      appointmentId: finalExisting?.appointment_id ?? metadata.appointmentId ?? null,
      status: paymentIntent.status,
    };
  }

  try {
    const transactionId = await insertTransaction(sb, storeId, paymentIntent, metadata, actorUserId);
    await insertTransactionItemsIfMissing(sb, transactionId, metadata.items ?? []);
    await markAppointmentPickedUpIfPending(sb, storeId, metadata);
    await finalizeInventory(sb, storeId, paymentIntent.id, metadata.items ?? [], actorUserId);

    if (checkoutRecord?.stripe_checkout_session_id) {
      const { error } = await sb
        .from("stripe_checkout_sessions")
        .update({
          stripe_account_id: stripeAccountId,
          payment_intent_id: paymentIntent.id,
          status: "complete",
          finalized_at: new Date().toISOString(),
          fulfillment_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_checkout_session_id", checkoutRecord.stripe_checkout_session_id);
      if (error) throw error;
    }

    await releaseFulfillmentClaim(sb, paymentIntent.id, claim.claimId!, "finalized");

    return {
      finalized: true,
      alreadyFinalized: false,
      storeId,
      receiptId: paymentIntent.id,
      transactionId,
      appointmentId: metadata.appointmentId ?? null,
      status: paymentIntent.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await releaseFulfillmentClaim(sb, paymentIntent.id, claim.claimId!, "failed", message).catch(() => {});
    throw error;
  }
}

/** Record a fulfillment failure so ops can investigate without losing the Stripe event. */
export async function recordFulfillmentFailure(opts: {
  paymentIntentId: string;
  storeId?: string | null;
  checkoutSessionId?: string | null;
  error: unknown;
}) {
  const sb = getSupabaseAdmin();
  const message = opts.error instanceof Error ? opts.error.message : String(opts.error);
  const now = new Date().toISOString();
  try {
    if (opts.checkoutSessionId) {
      await sb
        .from("stripe_checkout_sessions")
        .update({ fulfillment_error: message, updated_at: now })
        .eq("stripe_checkout_session_id", opts.checkoutSessionId);
    }
    const { data: existing } = await sb
      .from("payment_intents")
      .select("metadata")
      .eq("stripe_payment_intent_id", opts.paymentIntentId)
      .maybeSingle();
    const metadata = { ...(existing?.metadata as JsonObject | undefined ?? {}), fulfillment_error: message };
    await sb
      .from("payment_intents")
      .update({ metadata, updated_at: now })
      .eq("stripe_payment_intent_id", opts.paymentIntentId);
  } catch {
    // Never let failure-logging itself throw — the caller is already in an error path.
  }
}

export async function createCheckoutSessionRecord(row: {
  storeId: string;
  stripeAccountId: string;
  sessionId: string;
  internalTransactionId: string;
  successToken: string;
  appointmentId?: string | null;
  metadata: StripeSaleMetadata;
}) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("stripe_checkout_sessions").upsert({
    store_id: row.storeId,
    stripe_account_id: row.stripeAccountId,
    stripe_checkout_session_id: row.sessionId,
    internal_transaction_id: row.internalTransactionId,
    // Store only the hashed token at rest. The raw value is returned once to the
    // Stripe-hosted success URL and is never needed server-side again.
    success_token: null,
    success_token_hash: hashSuccessToken(row.successToken),
    appointment_id: row.appointmentId ?? null,
    metadata: row.metadata,
    status: "open",
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_checkout_session_id" });
  if (error) throw error;
}

export async function resolvePublicCheckoutSession(
  stripe: Stripe,
  sessionId: string,
  token: string,
): Promise<{
  sessionId: string;
  paid: boolean;
  finalized: boolean;
  receiptId: string | null;
  storeId: string;
  appointmentId: string | null;
}> {
  const checkoutRecord = await getCheckoutSessionRecordBySessionId(sessionId);
  if (!checkoutRecord) {
    throw new Error("NOT_FOUND: Checkout session not found");
  }
  const expectedHash = checkoutRecord.success_token_hash ?? (checkoutRecord.success_token ? hashSuccessToken(checkoutRecord.success_token) : null);
  const incomingHash = hashSuccessToken(token);
  if (!safeTokenMatch(expectedHash, incomingHash)) {
    throw new Error("NOT_FOUND: Checkout session not found");
  }

  const session = await stripe.checkout.sessions.retrieve(
    sessionId,
    { expand: ["payment_intent"] },
    { stripeAccount: checkoutRecord.stripe_account_id },
  );

  const paymentIntent = isExpandedPaymentIntent(session.payment_intent) ? session.payment_intent : null;
  const paid = session.payment_status === "paid" || paymentIntent?.status === "succeeded";
  let receiptId: string | null = paymentIntent?.id ?? checkoutRecord.payment_intent_id;
  let finalized = Boolean(checkoutRecord.finalized_at);

  const sb = getSupabaseAdmin();
  const { error: updateError } = await sb
    .from("stripe_checkout_sessions")
    .update({
      payment_intent_id: paymentIntent?.id ?? checkoutRecord.payment_intent_id,
      status: paid ? "paid" : (session.status ?? checkoutRecord.status),
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_checkout_session_id", sessionId);
  if (updateError) throw updateError;

  if (paid && paymentIntent) {
    try {
      const result = await finalizePaymentIntentSale({
        paymentIntent,
        stripeAccountId: checkoutRecord.stripe_account_id,
      });
      finalized = result.finalized;
      receiptId = result.receiptId;
    } catch (error) {
      await recordFulfillmentFailure({
        paymentIntentId: paymentIntent.id,
        storeId: checkoutRecord.store_id,
        checkoutSessionId: checkoutRecord.stripe_checkout_session_id,
        error,
      });
    }
  }

  return {
    sessionId,
    paid,
    finalized,
    receiptId,
    storeId: checkoutRecord.store_id,
    appointmentId: checkoutRecord.appointment_id,
  };
}

