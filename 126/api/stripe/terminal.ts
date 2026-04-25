import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getStripe, resolveTenant, getSupabaseAdmin, ok, fail, upsertPaymentIntent, appFeeCents, internalTxId } from "./_lib.js";
import { normalizeStripeSaleMetadata } from "./_fulfillment.js";

type AddressInput = {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

function missingAddressFields(addr: AddressInput): string[] {
  const required: Array<keyof AddressInput> = ["line1", "city", "state", "postal_code", "country"];
  return required.filter((field) => {
    const value = addr[field];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json(fail("METHOD_NOT_ALLOWED", "Use POST"));

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action as string | undefined;
    if (!action) return res.status(400).json(fail("VALIDATION_ERROR", "Missing action"));

    const tenant = await resolveTenant(req);
    const stripe = getStripe();

    if (action === "connection_token") {
      const locationId = typeof body.locationId === "string" ? body.locationId : undefined;
      const ct = await stripe.terminal.connectionTokens.create(locationId ? { location: locationId } : {}, { stripeAccount: tenant.stripeAccountId });
      return res.status(200).json(ok({ secret: ct.secret }));
    }

    if (action === "location_get") {
      const { data } = await getSupabaseAdmin()
        .from("terminal_locations")
        .select("stripe_location_id, label")
        .eq("store_id", tenant.storeId)
        .maybeSingle();
      return res.status(200).json(ok({
        locationId: data?.stripe_location_id ?? null,
        label: data?.label ?? null,
      }));
    }

    if (action === "location_create") {
      // Create (or reuse) a Stripe Terminal Location for this store's connected
      // account so owners don't have to copy/paste a `tml_` ID. If the store
      // already has one saved, return it unchanged.
      const sb = getSupabaseAdmin();
      const { data: existing } = await sb
        .from("terminal_locations")
        .select("stripe_location_id, label")
        .eq("store_id", tenant.storeId)
        .maybeSingle();
      if (existing?.stripe_location_id) {
        return res.status(200).json(ok({ locationId: existing.stripe_location_id, label: existing.label ?? null, created: false }));
      }

      // Business address is stored in `business_settings.address` as JSONB with
      // { street, city, state, zip, website } (see businessSettingsMapper.ts).
      // The connected account's business_profile address is used as a fallback.
      const { data: settings } = await sb
        .from("business_settings")
        .select("company_name, address")
        .eq("store_id", tenant.storeId)
        .maybeSingle();

      const addr = (settings?.address as Record<string, unknown> | null) ?? null;
      const line1 = typeof addr?.street === "string" ? addr.street.trim() : "";
      const city = typeof addr?.city === "string" ? addr.city.trim() : "";
      const state = typeof addr?.state === "string" ? addr.state.trim() : "";
      const postalCode = typeof addr?.zip === "string" ? addr.zip.trim() : "";
      const country = (typeof addr?.country === "string" && (addr.country as string).trim().length > 0)
        ? (addr.country as string).trim().toUpperCase()
        : "US";

      let resolvedLine1 = line1;
      let resolvedCity = city;
      let resolvedState = state;
      let resolvedPostal = postalCode;
      let resolvedCountry = country;

      const missingBefore = missingAddressFields({ line1, city, state, postal_code: postalCode, country });
      if (missingBefore.length > 0) {
        // Fallback: try the connected account's business_profile.support_address.
        try {
          const account = await stripe.accounts.retrieve(tenant.stripeAccountId);
          const supportAddress = account.business_profile?.support_address;
          if (supportAddress) {
            resolvedLine1 = resolvedLine1 || (supportAddress.line1 ?? "").trim();
            resolvedCity = resolvedCity || (supportAddress.city ?? "").trim();
            resolvedState = resolvedState || (supportAddress.state ?? "").trim();
            resolvedPostal = resolvedPostal || (supportAddress.postal_code ?? "").trim();
            resolvedCountry = (resolvedCountry && resolvedCountry !== "US") ? resolvedCountry : ((supportAddress.country ?? resolvedCountry ?? "US").trim().toUpperCase());
          }
        } catch {
          // Stripe account lookup is best-effort for the address fallback.
        }
      }

      const missingFields = missingAddressFields({
        line1: resolvedLine1,
        city: resolvedCity,
        state: resolvedState,
        postal_code: resolvedPostal,
        country: resolvedCountry,
      });
      if (missingFields.length > 0) {
        return res.status(400).json(
          fail(
            "TERMINAL_LOCATION_ADDRESS_REQUIRED",
            "Complete the store address before creating a Stripe Terminal Location.",
            { missingFields },
          ),
        );
      }

      const displayName = typeof body.displayName === "string" && body.displayName.trim().length > 0
        ? body.displayName.trim()
        : (typeof settings?.company_name === "string" && settings.company_name.trim().length > 0
            ? settings.company_name.trim()
            : "Primary location");

      const location = await stripe.terminal.locations.create({
        display_name: displayName,
        address: {
          line1: resolvedLine1,
          city: resolvedCity,
          state: resolvedState,
          postal_code: resolvedPostal,
          country: resolvedCountry,
        },
      }, { stripeAccount: tenant.stripeAccountId });

      const { error } = await sb.from("terminal_locations").upsert({
        store_id: tenant.storeId,
        stripe_location_id: location.id,
        label: displayName,
        updated_at: new Date().toISOString(),
      }, { onConflict: "store_id" });
      if (error) throw error;
      return res.status(200).json(ok({ locationId: location.id, label: displayName, created: true }));
    }

    if (action === "location_set") {
      const locationId = String(body.locationId ?? "").trim();
      const label = typeof body.label === "string" ? body.label : null;
      if (!locationId) return res.status(400).json(fail("VALIDATION_ERROR", "locationId is required"));
      const { error } = await getSupabaseAdmin().from("terminal_locations").upsert({
        store_id: tenant.storeId,
        stripe_location_id: locationId,
        label,
        updated_at: new Date().toISOString(),
      }, { onConflict: "store_id" });
      if (error) throw error;
      return res.status(200).json(ok({ locationId, label }));
    }

    if (action === "reader_save") {
      const readerId = String(body.readerId ?? "").trim();
      if (!readerId) return res.status(400).json(fail("VALIDATION_ERROR", "readerId is required"));

      const sb = getSupabaseAdmin();
      const { data: location } = await sb
        .from("terminal_locations")
        .select("id")
        .eq("store_id", tenant.storeId)
        .maybeSingle();

      const { error } = await sb.from("terminal_devices").upsert({
        store_id: tenant.storeId,
        terminal_location_id: location?.id ?? null,
        stripe_reader_id: readerId,
        label: typeof body.label === "string" ? body.label : null,
        device_type: typeof body.deviceType === "string" ? body.deviceType : null,
        status: typeof body.status === "string" ? body.status : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "store_id,stripe_reader_id" });
      if (error) throw error;
      return res.status(200).json(ok({ readerId }));
    }

    if (action === "payment_intents") {
      const amountCents = Number(body.amountCents ?? 0);
      if (!amountCents || amountCents < 50) return res.status(400).json(fail("VALIDATION_ERROR", "amountCents (>=50) is required"));
      const tip = Number(body.tipCents ?? 0) || 0;
      const tax = Number(body.taxCents ?? 0) || 0;
      const total = amountCents + tip + tax;

      const txId = (body.metadata as Record<string, string> | undefined)?.internalTransactionId ?? internalTxId();
      const localMetadata = normalizeStripeSaleMetadata(body.localMetadata ?? body.metadata);

      const pi = await stripe.paymentIntents.create({
        amount: total,
        currency: String(body.currency ?? "usd"),
        description: typeof body.description === "string" ? body.description : undefined,
        metadata: {
          salonId: tenant.storeId,
          internalTransactionId: txId,
          tipCents: String(tip),
          taxCents: String(tax),
          ...(localMetadata.appointmentId ? { appointmentId: localMetadata.appointmentId } : {}),
          ...(localMetadata.clientId ? { clientId: localMetadata.clientId } : {}),
        },
        payment_method_types: ["card_present"],
        capture_method: "manual",
        application_fee_amount: appFeeCents(total),
      }, { stripeAccount: tenant.stripeAccountId, idempotencyKey: `terminal_pi_${tenant.storeId}_${txId}` });

      await upsertPaymentIntent({
        internal_transaction_id: txId,
        stripe_payment_intent_id: pi.id,
        stripe_charge_id: typeof pi.latest_charge === "string" ? pi.latest_charge : null,
        status: pi.status,
        amount: pi.amount,
        currency: pi.currency,
        payment_method: "card_present",
        store_id: tenant.storeId,
        appointment_id: localMetadata.appointmentId ?? null,
        metadata: localMetadata,
        updated_at: new Date().toISOString(),
      });

      const sb = getSupabaseAdmin();
      const { data: loc } = await sb.from("terminal_locations").select("stripe_location_id").eq("store_id", tenant.storeId).maybeSingle();
      return res.status(200).json(ok({ client_secret: pi.client_secret, payment_intent_id: pi.id, location_id: loc?.stripe_location_id ?? null }));
    }

    return res.status(400).json(fail("VALIDATION_ERROR", `Unknown action: ${action}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terminal action failed";
    const status = message.startsWith("UNAUTHORIZED") ? 401 : message.startsWith("FORBIDDEN") || message.startsWith("MISSING_") ? 403 : 500;
    return res.status(status).json(fail("TERMINAL_ERROR", message));
  }
}
