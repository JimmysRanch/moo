import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getStripe, getSupabaseAdmin, ok, fail, resolveStore } from "./_lib.js";

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json(fail("METHOD_NOT_ALLOWED", "Use POST"));

  try {
    const body = (req.body ?? {}) as { action?: string };
    if (!body.action) return res.status(400).json(fail("VALIDATION_ERROR", "Missing action"));

    const store = await resolveStore(req);
    const sb = getSupabaseAdmin();
    const stripe = getStripe();

    if (body.action === "get_subscription") {
      const { data: row, error } = await sb
        .from("platform_subscriptions")
        .select("*")
        .eq("store_id", store.storeId)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json(ok({ subscription: row ?? null }));
    }

    if (body.action === "create_checkout_session") {
      const priceId = process.env.STRIPE_PLATFORM_PRICE_ID_MONTHLY;
      if (!priceId) return res.status(500).json(fail("CONFIG_ERROR", "Missing STRIPE_PLATFORM_PRICE_ID_MONTHLY"));

      // Ensure Stripe Customer exists
      const { data: sub, error: subErr } = await sb
        .from("platform_subscriptions")
        .select("stripe_customer_id")
        .eq("store_id", store.storeId)
        .maybeSingle();
      if (subErr) throw subErr;

      let customerId = sub?.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          metadata: { salonId: store.storeId },
        });
        customerId = customer.id;
        await sb.from("platform_subscriptions").upsert({
          store_id: store.storeId,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id" });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${BASE_URL}/settings?tab=card&sub=success`,
        cancel_url: `${BASE_URL}/settings?tab=card&sub=cancel`,
        metadata: { salonId: store.storeId },
        subscription_data: {
          metadata: { salonId: store.storeId },
        },
      });

      return res.status(200).json(ok({ url: session.url }));
    }

    if (body.action === "create_billing_portal") {
      const { data: sub, error: subErr } = await sb
        .from("platform_subscriptions")
        .select("stripe_customer_id")
        .eq("store_id", store.storeId)
        .maybeSingle();
      if (subErr) throw subErr;
      if (!sub?.stripe_customer_id) return res.status(400).json(fail("VALIDATION_ERROR", "No subscription customer found"));

      const returnUrl = process.env.STRIPE_BILLING_PORTAL_RETURN_URL || `${BASE_URL}/settings?tab=card`;
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: returnUrl,
      });

      return res.status(200).json(ok({ url: session.url }));
    }

    return res.status(400).json(fail("VALIDATION_ERROR", `Unknown action: ${body.action}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing action failed";
    const status = message.startsWith("UNAUTHORIZED") ? 401 : message.startsWith("FORBIDDEN") || message.startsWith("MISSING_") ? 403 : 500;
    return res.status(status).json(fail("BILLING_ERROR", message));
  }
}
