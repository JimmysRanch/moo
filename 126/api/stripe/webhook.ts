import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { getStripe, ok, fail, recordWebhookEvent, upsertPaymentIntent, upsertRefund, getSupabaseAdmin, upsertStripeDispute, upsertStripePayout } from "./_lib.js";
import { finalizePaymentIntentSale, normalizeStripeSaleMetadata, recordFulfillmentFailure } from "./_fulfillment.js";

export const config = { api: { bodyParser: false } };

async function readRaw(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<string | Buffer>) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

/** Derive store_id from event metadata, supporting both Connect payment events and platform billing events */
function deriveStoreId(event: Stripe.Event): string | undefined {
  const obj = event.data.object as unknown as Record<string, unknown>;

  // Direct metadata (payment_intent, charge, etc.)
  const directMeta = obj.metadata as Record<string, string> | undefined;
  if (directMeta?.salonId) return directMeta.salonId;

  // Subscription metadata (customer.subscription.*)
  if (obj.object === "subscription" || (obj as { items?: unknown }).items) {
    const subMeta = (obj as { metadata?: Record<string, string> }).metadata;
    if (subMeta?.salonId) return subMeta.salonId;
  }

  // Invoice: check subscription_details or lines
  if ((obj as { subscription?: unknown }).subscription) {
    const invoiceMeta = (obj as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata;
    if (invoiceMeta?.salonId) return invoiceMeta.salonId;
  }

  return undefined;
}

async function storeIdFromConnectedAccount(accountId: string | null | undefined): Promise<string | undefined> {
  if (!accountId) return undefined;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("stripe_connections")
    .select("salon_id")
    .eq("stripe_account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data?.salon_id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json(fail("METHOD_NOT_ALLOWED", "Use POST"));

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json(fail("CONFIG_ERROR", "Missing STRIPE_WEBHOOK_SECRET"));

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") return res.status(400).json(fail("SIGNATURE_INVALID", "Missing stripe-signature header"));

  try {
    const stripe = getStripe();
    const raw = await readRaw(req);
    const event = stripe.webhooks.constructEvent(raw, sig, secret);

    const storeIdFromAccount = await storeIdFromConnectedAccount(event.account ?? null);
    const eventStoreId = storeIdFromAccount ?? deriveStoreId(event);

    const firstInsert = await recordWebhookEvent(event.id, event.type, event.data.object, eventStoreId);
    if (!firstInsert) return res.status(200).json(ok({ received: true, duplicate: true }));

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const sb = getSupabaseAdmin();
      const chargesEnabled = account.charges_enabled ?? false;
      const payoutsEnabled = account.payouts_enabled ?? false;
      const detailsSubmitted = account.details_submitted ?? false;
      const onboardingComplete = Boolean(chargesEnabled && payoutsEnabled && detailsSubmitted);
      const due = Array.from(new Set([...(account.requirements?.currently_due ?? []), ...(account.requirements?.eventually_due ?? [])]));
      const disabledReason = account.requirements?.disabled_reason ?? null;
      const cardSetupStatus = chargesEnabled
        ? "active"
        : disabledReason
          ? "restricted"
          : detailsSubmitted
            ? "pending"
            : "not_set_up";
      const { error } = await sb
        .from("stripe_connections")
        .update({
          charges_enabled: chargesEnabled,
          stripe_charges_enabled: chargesEnabled,
          payouts_enabled: payoutsEnabled,
          stripe_payouts_enabled: payoutsEnabled,
          details_submitted: detailsSubmitted,
          stripe_details_submitted: detailsSubmitted,
          stripe_requirements_due: due,
          stripe_disabled_reason: disabledReason,
          stripe_card_setup_status: cardSetupStatus,
          onboarding_complete: onboardingComplete,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_account_id", account.id);
      if (error) throw error;
    }

    if (
      event.type === "payment_intent.succeeded"
      || event.type === "payment_intent.processing"
      || event.type === "payment_intent.payment_failed"
      || event.type === "payment_intent.canceled"
    ) {
      const pi = event.data.object as Stripe.PaymentIntent;
      const storeId = pi.metadata?.salonId;
      if (storeId) {
        const existing = await getSupabaseAdmin()
          .from("payment_intents")
          .select("metadata, appointment_id")
          .eq("stripe_payment_intent_id", pi.id)
          .maybeSingle();
        if (existing.error) throw existing.error;
        const localMetadata = normalizeStripeSaleMetadata(existing.data?.metadata);
        await upsertPaymentIntent({
          internal_transaction_id: pi.metadata?.internalTransactionId ?? null,
          stripe_payment_intent_id: pi.id,
          stripe_charge_id: typeof pi.latest_charge === "string" ? pi.latest_charge : null,
          status: pi.status,
          amount: pi.amount,
          currency: pi.currency,
          payment_method: pi.payment_method_types?.[0] ?? "unknown",
          store_id: storeId,
          appointment_id: localMetadata.appointmentId ?? existing.data?.appointment_id ?? null,
          metadata: localMetadata,
          updated_at: new Date().toISOString(),
        });

        if (event.type === "payment_intent.succeeded" && event.account) {
          try {
            await finalizePaymentIntentSale({
              paymentIntent: pi,
              stripeAccountId: event.account,
            });
          } catch (fulfillmentError) {
            // Never let a local fulfillment failure cause Stripe to keep retrying
            // this webhook. The event + PI projection have already been persisted
            // above; surface the failure for ops without failing the webhook.
            await recordFulfillmentFailure({
              paymentIntentId: pi.id,
              storeId,
              checkoutSessionId: (pi.metadata?.checkoutSessionId as string | undefined) ?? null,
              error: fulfillmentError,
            });
          }
        }
      }
    }

    // ── Checkout Session events ──────────────────────────────────────────
    // Subscribing to checkout.session.completed + async_payment_* is how we
    // finalize sales produced by the Checkout-Session flow (remote-link and
    // delayed-payment methods). We *only* finalize when Stripe confirms the
    // session's payment_status is successful ("paid" or "no_payment_required");
    // "unpaid" (async delayed) or async_payment_failed are left pending.
    if (
      event.type === "checkout.session.completed"
      || event.type === "checkout.session.async_payment_succeeded"
      || event.type === "checkout.session.async_payment_failed"
    ) {
      const sessionObj = event.data.object as Stripe.Checkout.Session;
      const stripeAccountId = event.account ?? null;

      // Re-fetch the session from Stripe with payment_intent + line_items
      // expanded so we have an authoritative view rather than trusting the
      // webhook payload blindly.
      let session: Stripe.Checkout.Session = sessionObj;
      if (stripeAccountId) {
        try {
          session = await stripe.checkout.sessions.retrieve(
            sessionObj.id,
            { expand: ["payment_intent", "line_items", "line_items.data.price.product"] },
            { stripeAccount: stripeAccountId },
          );
        } catch {
          // If retrieval fails, fall back to the webhook payload. The claim
          // system below will still guard idempotency.
          session = sessionObj;
        }
      }

      const sb = getSupabaseAdmin();
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
      const paymentStatus = session.payment_status ?? "unpaid";
      const isPaid = paymentStatus === "paid" || paymentStatus === "no_payment_required";
      const sessionFailed = event.type === "checkout.session.async_payment_failed";

      const checkoutStatus = sessionFailed
        ? "payment_failed"
        : isPaid
          ? "complete"
          : "open";

      // Best-effort projection update; only touch the row if we already
      // created it from the POS side.
      await sb
        .from("stripe_checkout_sessions")
        .update({
          payment_intent_id: paymentIntentId,
          status: checkoutStatus,
          last_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(sessionFailed
            ? { fulfillment_error: "Stripe reported async_payment_failed" }
            : {}),
        })
        .eq("stripe_checkout_session_id", session.id);

      // Only finalize once Stripe has confirmed the payment is actually paid.
      if (
        (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded")
        && isPaid
        && stripeAccountId
      ) {
        // The session.payment_intent may have been returned expanded above;
        // if not, fetch it so we have the full object for finalization.
        let pi: Stripe.PaymentIntent | null = null;
        if (session.payment_intent && typeof session.payment_intent === "object") {
          pi = session.payment_intent as Stripe.PaymentIntent;
        } else if (paymentIntentId) {
          try {
            pi = await stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: stripeAccountId });
          } catch {
            pi = null;
          }
        }

        if (pi) {
          const storeIdForSession = storeIdFromAccount
            ?? session.metadata?.salonId
            ?? pi.metadata?.salonId
            ?? eventStoreId;
          try {
            await finalizePaymentIntentSale({
              paymentIntent: pi,
              stripeAccountId,
            });
          } catch (fulfillmentError) {
            // Swallow and record so Stripe does not keep retrying the webhook.
            await recordFulfillmentFailure({
              paymentIntentId: pi.id,
              storeId: storeIdForSession,
              checkoutSessionId: session.id,
              error: fulfillmentError,
            });
          }
        }
      }
    }

    if (event.type === "charge.succeeded") {
      const ch = event.data.object as Stripe.Charge;
      const storeId = ch.metadata?.salonId;
      if (storeId && typeof ch.payment_intent === "string") {
        await upsertPaymentIntent({
          internal_transaction_id: ch.metadata?.internalTransactionId ?? null,
          stripe_payment_intent_id: ch.payment_intent,
          stripe_charge_id: ch.id,
          status: "succeeded",
          amount: ch.amount,
          currency: ch.currency,
          payment_method: ch.payment_method_details?.type ?? "card",
          store_id: storeId,
          metadata: ch.metadata,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (event.type === "charge.refunded") {
      const ch = event.data.object as Stripe.Charge;
      const storeId = ch.metadata?.salonId;
      if (storeId) {
        for (const refund of ch.refunds?.data ?? []) {
          await upsertRefund({
            stripe_refund_id: refund.id,
            stripe_payment_intent_id: typeof ch.payment_intent === "string" ? ch.payment_intent : null,
            amount: refund.amount,
            reason: refund.reason,
            status: refund.status ?? "pending",
            store_id: storeId,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (event.type === "refund.updated") {
      const refund = event.data.object as Stripe.Refund;
      const storeId = refund.metadata?.salonId;
      if (storeId) {
        await upsertRefund({
          stripe_refund_id: refund.id,
          stripe_payment_intent_id: typeof refund.payment_intent === "string" ? refund.payment_intent : null,
          amount: refund.amount,
          reason: refund.reason,
          status: refund.status ?? "pending",
          store_id: storeId,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // ── Dispute events (connected accounts) ──────────────────────────────
    if (event.type === "charge.dispute.created" || event.type === "charge.dispute.updated" || event.type === "charge.dispute.closed") {
      const dispute = event.data.object as Stripe.Dispute;
      const storeId = storeIdFromAccount ?? dispute.metadata?.salonId ?? eventStoreId;
      if (storeId) {
        await upsertStripeDispute({
          stripe_dispute_id: dispute.id,
          stripe_charge_id: typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null,
          stripe_payment_intent_id: typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null,
          store_id: storeId,
          amount: dispute.amount,
          currency: dispute.currency,
          reason: dispute.reason,
          status: dispute.status,
          due_by: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
          closed_at: event.type === "charge.dispute.closed" ? new Date().toISOString() : null,
          metadata: (dispute.metadata ?? {}) as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        });
      }
    }

    if (event.type === "payout.created" || event.type === "payout.paid" || event.type === "payout.failed") {
      const payout = event.data.object as Stripe.Payout;
      const storeId = storeIdFromAccount ?? payout.metadata?.salonId ?? eventStoreId;
      if (storeId) {
        await upsertStripePayout({
          stripe_payout_id: payout.id,
          store_id: storeId,
          amount: payout.amount,
          currency: payout.currency,
          status: payout.status,
          arrival_date: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
          failure_code: payout.failure_code,
          failure_message: payout.failure_message,
          method: payout.method,
          type: payout.type,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // ── Platform billing: subscription lifecycle ─────────────────────────
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const currentPeriodEnd = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
      const storeId = sub.metadata?.salonId ?? eventStoreId;
      if (storeId) {
        const sb = getSupabaseAdmin();
        await sb.from("platform_subscriptions").upsert({
          store_id: storeId,
          stripe_customer_id: typeof sub.customer === "string" ? sub.customer : (sub.customer as { id: string }).id,
          stripe_subscription_id: sub.id,
          status: sub.status,
          current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id" });
      } else {
        // Fallback: try to find store by customer id
        const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as { id: string }).id;
        const sb = getSupabaseAdmin();
        const { data: existing } = await sb
          .from("platform_subscriptions")
          .select("store_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (existing?.store_id) {
          await sb.from("platform_subscriptions").upsert({
            store_id: existing.store_id,
            stripe_customer_id: customerId,
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end ?? false,
            updated_at: new Date().toISOString(),
          }, { onConflict: "store_id" });
        }
      }
    }

    // ── Platform billing: invoice events ─────────────────────────────────
    // Instead of blindly overriding subscription status, fetch the actual subscription
    // from Stripe to get the canonical status (e.g. invoice.paid during trialing should
    // not flip status to active).
    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : (invoice.customer as { id: string } | null)?.id;
      const subscriptionValue = (invoice as Stripe.Invoice & { subscription?: string | null }).subscription;
      const subscriptionId = typeof subscriptionValue === "string" ? subscriptionValue : null;
      if (customerId && subscriptionId) {
        const sb = getSupabaseAdmin();
        const { data: existing } = await sb
          .from("platform_subscriptions")
          .select("store_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (existing?.store_id) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await sb.from("platform_subscriptions")
            .update({ status: sub.status, updated_at: new Date().toISOString() })
            .eq("store_id", existing.store_id);
        }
      }
    }

    return res.status(200).json(ok({ received: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return res.status(400).json(fail("WEBHOOK_ERROR", message));
  }
}
