import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getStripe, resolveTenant, ok, fail, upsertPaymentIntent, internalTxId, upsertRefund, getSupabaseAdmin, appFeeCents } from "./_lib.js";
import { createCheckoutSessionRecord, finalizePaymentIntentSale, normalizeStripeSaleMetadata } from "./_fulfillment.js";
import { enforceRefundPolicy } from "../../lib/stripe/refundPolicy.js";

const validRoles = new Set(["front_desk", "manager", "owner", "admin"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json(fail("METHOD_NOT_ALLOWED", "Use POST or GET"));

  try {
    const tenant = await resolveTenant(req);

    if (req.method === "GET") {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb
        .from("payment_intents")
        .select("*")
        .eq("store_id", tenant.storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return res.status(200).json(ok({ payments: data ?? [] }));
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action as string | undefined;
    if (!action) return res.status(400).json(fail("VALIDATION_ERROR", "Missing action"));

    const stripe = getStripe();

    if (action === "create_intent") {
      const amount = Number(body.amountCents ?? body.amount ?? 0);
      if (!amount || amount < 50) return res.status(400).json(fail("VALIDATION_ERROR", "amountCents (>=50) is required"));
      const txId = internalTxId();
      const localMetadata = normalizeStripeSaleMetadata(body.localMetadata ?? body.metadata);
      const pi = await stripe.paymentIntents.create({
        amount,
        currency: String(body.currency ?? "usd"),
        automatic_payment_methods: { enabled: true },
        application_fee_amount: appFeeCents(amount),
        description: typeof body.description === "string" ? body.description : undefined,
        metadata: {
          salonId: tenant.storeId,
          internalTransactionId: txId,
          ...(localMetadata.appointmentId ? { appointmentId: localMetadata.appointmentId } : {}),
          ...(localMetadata.clientId ? { clientId: localMetadata.clientId } : {}),
        },
      }, { stripeAccount: tenant.stripeAccountId, idempotencyKey: `manual_intent_${tenant.storeId}_${txId}` });

      await upsertPaymentIntent({
        internal_transaction_id: txId,
        stripe_payment_intent_id: pi.id,
        stripe_charge_id: typeof pi.latest_charge === "string" ? pi.latest_charge : null,
        status: pi.status,
        amount: pi.amount,
        currency: pi.currency,
        payment_method: "manual_entry",
        store_id: tenant.storeId,
        appointment_id: localMetadata.appointmentId ?? null,
        metadata: localMetadata,
        updated_at: new Date().toISOString(),
      });

      return res.status(200).json(ok({ clientSecret: pi.client_secret, paymentIntentId: pi.id, internalTransactionId: txId }));
    }

    if (action === "capture") {
      const paymentIntentId = String(body.paymentIntentId ?? "");
      if (!paymentIntentId) return res.status(400).json(fail("VALIDATION_ERROR", "paymentIntentId is required"));
      const pi = await stripe.paymentIntents.capture(paymentIntentId, {}, { stripeAccount: tenant.stripeAccountId });
      await upsertPaymentIntent({
        stripe_payment_intent_id: pi.id,
        stripe_charge_id: typeof pi.latest_charge === "string" ? pi.latest_charge : null,
        status: pi.status,
        amount: pi.amount,
        currency: pi.currency,
        payment_method: pi.payment_method_types?.[0] ?? "unknown",
        store_id: tenant.storeId,
        metadata: pi.metadata,
        updated_at: new Date().toISOString(),
      });
      return res.status(200).json(ok({ paymentIntentId: pi.id, status: pi.status }));
    }

    if (action === "cancel") {
      const paymentIntentId = String(body.paymentIntentId ?? "");
      if (!paymentIntentId) return res.status(400).json(fail("VALIDATION_ERROR", "paymentIntentId is required"));
      const pi = await stripe.paymentIntents.cancel(paymentIntentId, {}, { stripeAccount: tenant.stripeAccountId });
      await upsertPaymentIntent({
        stripe_payment_intent_id: pi.id,
        stripe_charge_id: typeof pi.latest_charge === "string" ? pi.latest_charge : null,
        status: pi.status,
        amount: pi.amount,
        currency: pi.currency,
        payment_method: pi.payment_method_types?.[0] ?? "unknown",
        store_id: tenant.storeId,
        metadata: pi.metadata,
        updated_at: new Date().toISOString(),
      });
      return res.status(200).json(ok({ paymentIntentId: pi.id, status: pi.status }));
    }

    // The legacy `create_link` action (Stripe Payment Links API) has been
    // removed. PaymentLinks do not support application_fee_amount on connected
    // accounts, which means platform fees and reconciliation are not handled
    // consistently. All remote-payment flows must go through Checkout Sessions
    // via `create_checkout_link`.
    if (action === "create_link") {
      return res.status(410).json(fail(
        "PAYMENT_LINKS_REMOVED",
        "Stripe Payment Links are no longer supported. Use action 'create_checkout_link' (Checkout Sessions) instead.",
      ));
    }

    if (action === "create_checkout_link") {
      const amountCents = Number(body.amountCents ?? 0);
      if (!amountCents || amountCents < 50) return res.status(400).json(fail("VALIDATION_ERROR", "amountCents (>=50) is required"));
      const txId = internalTxId();
      const successToken = internalTxId();
      const baseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
      const localMetadata = normalizeStripeSaleMetadata(body.localMetadata ?? body.metadata);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          price_data: {
            currency: String(body.currency ?? "usd"),
            unit_amount: amountCents,
            product_data: { name: typeof body.description === "string" ? body.description : "Store payment" },
          },
          quantity: 1,
        }],
        payment_intent_data: {
          application_fee_amount: appFeeCents(amountCents),
          metadata: {
            salonId: tenant.storeId,
            internalTransactionId: txId,
            ...(localMetadata.appointmentId ? { appointmentId: localMetadata.appointmentId } : {}),
            ...(localMetadata.clientId ? { clientId: localMetadata.clientId } : {}),
          },
        },
        success_url: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}&token=${successToken}`,
        cancel_url: `${baseUrl}/payments/cancel?session_id={CHECKOUT_SESSION_ID}&token=${successToken}`,
        metadata: { salonId: tenant.storeId, internalTransactionId: txId },
      }, { stripeAccount: tenant.stripeAccountId, idempotencyKey: `checkout_${tenant.storeId}_${txId}` });

      await createCheckoutSessionRecord({
        storeId: tenant.storeId,
        stripeAccountId: tenant.stripeAccountId,
        sessionId: session.id,
        internalTransactionId: txId,
        successToken,
        appointmentId: localMetadata.appointmentId ?? null,
        metadata: { ...localMetadata, checkoutSessionId: session.id },
      });

      return res.status(200).json(ok({ url: session.url, sessionId: session.id, internalTransactionId: txId }));
    }

    if (action === "get_intent") {
      const paymentIntentId = String(body.paymentIntentId ?? "");
      if (!paymentIntentId) return res.status(400).json(fail("VALIDATION_ERROR", "paymentIntentId is required"));
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: tenant.stripeAccountId });
      await upsertPaymentIntent({
        stripe_payment_intent_id: pi.id,
        stripe_charge_id: typeof pi.latest_charge === "string" ? pi.latest_charge : null,
        status: pi.status,
        amount: pi.amount,
        currency: pi.currency,
        payment_method: pi.payment_method_types?.[0] ?? "unknown",
        store_id: tenant.storeId,
        metadata: pi.metadata,
        updated_at: new Date().toISOString(),
      });
      return res.status(200).json(ok({ paymentIntent: { id: pi.id, status: pi.status, latest_charge: typeof pi.latest_charge === "string" ? pi.latest_charge : null } }));
    }

    if (action === "refund_create") {
      const paymentIntentId = String(body.paymentIntentId ?? "");
      const amount = Number(body.amount ?? body.amountCents ?? 0);
      const reasonCode = String(body.reasonCode ?? "").trim();
      if (!paymentIntentId || !amount) return res.status(400).json(fail("VALIDATION_ERROR", "paymentIntentId and amount are required"));
      if (!reasonCode) return res.status(400).json(fail("VALIDATION_ERROR", "reasonCode is required for refunds (audit trail)"));

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: tenant.stripeAccountId });
      
      // Extract and validate actor role
      function getActorRole(): string {
        if (typeof body.actor === "object" && body.actor) {
          const actorObj = body.actor as Record<string, unknown>;
          if (typeof actorObj.role === "string" && validRoles.has(actorObj.role)) {
            return actorObj.role;
          }
        }
        return tenant.role;
      }
      const role = getActorRole();
      
      const breakdown = (body.breakdown as { serviceAmount: number; tipAmount: number; taxAmount: number } | undefined) ?? { serviceAmount: amount, tipAmount: 0, taxAmount: 0 };
      const blocked = enforceRefundPolicy({
        actor: { userId: tenant.userId, role: role as "front_desk" | "manager" | "owner" | "admin" },
        amount,
        breakdown,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        originalPaymentCreatedAt: pi.created * 1000,
        paymentMethod: "card",
      });
      if (blocked) return res.status(403).json(blocked);

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
        reason: "requested_by_customer",
        metadata: {
          salonId: tenant.storeId,
          reasonCode,
          actorRole: role,
          actorUserId: tenant.userId,
          originalPaymentIntentId: paymentIntentId,
          requestedAt: new Date().toISOString(),
        },
      }, { stripeAccount: tenant.stripeAccountId, idempotencyKey: `refund_${tenant.storeId}_${paymentIntentId}_${amount}` });

      await upsertRefund({
        stripe_refund_id: refund.id,
        stripe_payment_intent_id: paymentIntentId,
        amount: refund.amount,
        reason: reasonCode,
        actor_user_id: tenant.userId,
        actor_role: role,
        status: refund.status ?? "pending",
        store_id: tenant.storeId,
        updated_at: new Date().toISOString(),
      });

      return res.status(200).json(ok({ id: refund.id, refundId: refund.id, amount: refund.amount, status: refund.status }));
    }

    if (action === "finalize_sale") {
      const paymentIntentId = String(body.paymentIntentId ?? "").trim();
      if (!paymentIntentId) return res.status(400).json(fail("VALIDATION_ERROR", "paymentIntentId is required"));
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: tenant.stripeAccountId });
      const result = await finalizePaymentIntentSale({
        paymentIntent,
        stripeAccountId: tenant.stripeAccountId,
        actorUserId: tenant.userId,
      });
      return res.status(200).json(ok({ ...result }));
    }

    if (action === "refund_list") {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb.from("refunds").select("*").eq("store_id", tenant.storeId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return res.status(200).json(ok({ refunds: data ?? [] }));
    }

    return res.status(400).json(fail("VALIDATION_ERROR", `Unknown action: ${action}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payments action failed";
    const status = message.startsWith("UNAUTHORIZED") ? 401 : message.startsWith("FORBIDDEN") || message.startsWith("MISSING_") ? 403 : 500;
    return res.status(status).json(fail("PAYMENTS_ERROR", message));
  }
}
