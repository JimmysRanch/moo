import type { VercelRequest, VercelResponse } from "@vercel/node";
import type Stripe from "stripe";
import { getStripe, getSupabaseAdmin, ok, fail, resolveStore, webhookSyncTimestamp } from "./_lib.js";

function canManageCardSetup(role: string): boolean {
  return role === "owner" || role === "admin";
}

async function requireStripeAccount(storeId: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data: conn, error } = await sb
    .from("stripe_connections")
    .select("stripe_account_id")
    .eq("salon_id", storeId)
    .maybeSingle();
  if (error) throw error;
  if (!conn?.stripe_account_id) throw new Error("FORBIDDEN: Stripe account is not connected for this store");
  return conn.stripe_account_id;
}

async function findOrCreateStripeAccount(storeId: string, stripe: Stripe, country = "US"): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data: existing, error: existingErr } = await sb
    .from("stripe_connections")
    .select("stripe_account_id")
    .eq("salon_id", storeId)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing?.stripe_account_id) return existing.stripe_account_id;

  const account = await stripe.accounts.create({
    metadata: { salonId: storeId },
    ...( {
      dashboard: "none",
      identity: {
        country,
        entity_type: "company",
      },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: {
              requested: true,
            },
          },
        },
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: {
                requested: true,
              },
            },
          },
        },
      },
    } as Record<string, unknown>),
  } as Stripe.AccountCreateParams);

  const { error: upsertErr } = await sb.from("stripe_connections").upsert({
    salon_id: storeId,
    stripe_account_id: account.id,
    stripe_connected_account_id: account.id,
    stripe_card_setup_status: "not_set_up",
    charges_enabled: account.charges_enabled ?? false,
    stripe_charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    stripe_payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    stripe_details_submitted: account.details_submitted ?? false,
    stripe_requirements_due: [],
    stripe_disabled_reason: account.requirements?.disabled_reason ?? null,
    onboarding_complete: Boolean(account.charges_enabled && account.payouts_enabled && account.details_submitted),
    updated_at: new Date().toISOString(),
  }, { onConflict: "salon_id" });
  if (upsertErr) throw upsertErr;

  return account.id;
}

function canRespondToDispute(role: string): boolean {
  return role === "manager" || role === "owner" || role === "admin";
}

function extractChargeFields(charge: unknown): { payment_method_last4: string | null; payment_method_brand: string | null } {
  if (!charge || typeof charge !== "object") {
    return { payment_method_last4: null, payment_method_brand: null };
  }

  const source = charge as {
    payment_method_details?: {
      card?: { last4?: string; brand?: string };
    };
  };

  return {
    payment_method_last4: source.payment_method_details?.card?.last4 ?? null,
    payment_method_brand: source.payment_method_details?.card?.brand ?? null,
  }
}

function serializePayout(
  payout: Stripe.Payout,
  externalAccountById: Map<string, Stripe.BankAccount | Stripe.Card>,
) {
  const destinationId = typeof payout.destination === "string" ? payout.destination : payout.destination?.id;
  const destination = destinationId ? externalAccountById.get(destinationId) : null;
  const balanceTx = payout.balance_transaction;
  const expandedBalanceTx = typeof balanceTx === "object" && balanceTx && "id" in balanceTx
    ? (balanceTx as Stripe.BalanceTransaction)
    : null;

  return {
    id: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    created: payout.created,
    arrival_date: payout.arrival_date,
    status: payout.status,
    method: payout.method,
    type: payout.type,
    statement_descriptor: payout.statement_descriptor,
    description: payout.description,
    failure_code: payout.failure_code,
    failure_message: payout.failure_message,
    destination_id: destinationId ?? null,
    destination_type: destination?.object ?? null,
    destination_label: destination
      ? destination.object === "bank_account"
        ? `${destination.bank_name ?? "Bank"} •••• ${destination.last4 ?? ""}`.trim()
        : `${destination.brand ?? "Card"} •••• ${destination.last4 ?? ""}`.trim()
      : null,
    destination_summary: destination
      ? {
          id: destination.id,
          object: destination.object,
          bank_name: destination.object === "bank_account" ? destination.bank_name : null,
          brand: destination.object === "card" ? destination.brand : null,
          country: destination.country,
          currency: destination.currency,
          last4: destination.last4,
          status: destination.object === "bank_account" ? destination.status : null,
        }
      : null,
    balance_transaction_id: typeof balanceTx === "string" ? balanceTx : balanceTx?.id ?? null,
    fees: expandedBalanceTx?.fee ?? null,
    gross_amount: expandedBalanceTx?.amount ?? payout.amount,
    net_amount: expandedBalanceTx?.net ?? payout.amount,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json(fail("METHOD_NOT_ALLOWED", "Use POST"));

  try {
    const body = (req.body ?? {}) as {
      action?: string;
      salonId?: string;
      country?: string;
      limit?: number;
      starting_after?: string;
      disputeId?: string;
      notes?: string;
      files?: unknown;
      evidence?: unknown;
    };
    if (!body.action) return res.status(400).json(fail("VALIDATION_ERROR", "Missing action"));

    const store = await resolveStore(req);
    const stripe = getStripe();

    if (body.action === "accounts") {
      if (!canManageCardSetup(store.role)) {
        return res.status(403).json(fail("FORBIDDEN", "Only an owner or admin can manage card setup."));
      }
      const accountId = await findOrCreateStripeAccount(store.storeId, stripe, body.country ?? "US");
      return res.status(200).json(ok({ connectedAccountId: accountId }));
    }

    if (body.action === "status" || body.action === "health") {
      const sb = getSupabaseAdmin();
      const { data: conn, error: connErr } = await sb
        .from("stripe_connections")
        .select("stripe_account_id")
        .eq("salon_id", store.storeId)
        .maybeSingle();
      if (connErr) throw connErr;

      if (!conn?.stripe_account_id) {
        const webhookAt = await webhookSyncTimestamp(store.storeId);
        return res.status(200).json(ok({
          connected: false,
          storeId: store.storeId,
          stripe_account_id: null,
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          onboarding_complete: false,
          requirements_due: [],
          last_webhook_sync_at: webhookAt,
        }));
      }

      const acct = await stripe.accounts.retrieve(conn.stripe_account_id);
      const chargesEnabled = acct.charges_enabled ?? false;
      const payoutsEnabled = acct.payouts_enabled ?? false;
      const detailsSubmitted = acct.details_submitted ?? false;
      const onboardingComplete = Boolean(chargesEnabled && payoutsEnabled && detailsSubmitted);
      const due = Array.from(new Set([...(acct.requirements?.currently_due ?? []), ...(acct.requirements?.eventually_due ?? [])]));
      const disabledReason = acct.requirements?.disabled_reason ?? null;
      const cardSetupStatus = chargesEnabled
        ? "active"
        : disabledReason
          ? "restricted"
          : detailsSubmitted
            ? "pending"
            : "not_set_up";

      await sb.from("stripe_connections").upsert({
        salon_id: store.storeId,
        stripe_account_id: conn.stripe_account_id,
        stripe_connected_account_id: conn.stripe_account_id,
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
      }, { onConflict: "salon_id" });

      const webhookAt = await webhookSyncTimestamp(store.storeId);
      return res.status(200).json(ok({
        connected: true,
        storeId: store.storeId,
        stripe_account_id: conn.stripe_account_id,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        details_submitted: detailsSubmitted,
        onboarding_complete: onboardingComplete,
        requirements_due: due,
        disabled_reason: disabledReason,
        stripe_card_setup_status: cardSetupStatus,
        last_webhook_sync_at: webhookAt,
      }));
    }

    if (body.action === "account_session") {
      if (!canManageCardSetup(store.role)) {
        return res.status(403).json(fail("FORBIDDEN", "Only an owner or admin can manage card setup."));
      }
      const stripeAccountId = await findOrCreateStripeAccount(store.storeId, stripe);
      const acct = await stripe.accounts.retrieve(stripeAccountId);
      const requirements = Array.from(new Set([...(acct.requirements?.currently_due ?? []), ...(acct.requirements?.eventually_due ?? [])]));
      const documentsRequired = requirements.some((item) => item.includes("document"));

      const baseComponents: Stripe.AccountSessionCreateParams.Components = {
        notification_banner: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },
        account_onboarding: {
          enabled: true,
        },
        account_management: {
          enabled: true,
          features: {
            external_account_collection: true,
          },
        },
      };

      try {
        const session = await stripe.accountSessions.create({
          account: stripeAccountId,
          components: {
            ...baseComponents,
            ...(documentsRequired ? { documents: { enabled: true } } : {}),
          },
        });
        return res.status(200).json(ok({ client_secret: session.client_secret, documents_required: documentsRequired }));
      } catch (sessionError) {
        if (!documentsRequired) throw sessionError;
        const message = sessionError instanceof Error ? sessionError.message : String(sessionError);
        if (!message.toLowerCase().includes("documents")) throw sessionError;

        const fallbackSession = await stripe.accountSessions.create({
          account: stripeAccountId,
          components: baseComponents,
        });

        return res.status(200).json(ok({
          client_secret: fallbackSession.client_secret,
          documents_required: false,
          documents_warning: "Stripe documents are not available for this account yet.",
        }));
      }
    }

    if (body.action === "payout_summary" || body.action === "payouts_list") {
      const stripeAccountId = await requireStripeAccount(store.storeId);
      const limit = Math.min(Math.max(Number(body.limit ?? 20), 1), 100);
      const isPaginationRequest = body.action === "payouts_list" && typeof body.starting_after === "string" && !!body.starting_after;

      const payoutsResponse = await stripe.payouts.list(
        {
          limit,
          ...(typeof body.starting_after === "string" && body.starting_after ? { starting_after: body.starting_after } : {}),
          expand: ["data.balance_transaction"],
        },
        { stripeAccount: stripeAccountId },
      );

      const externalAccounts = await stripe.accounts.listExternalAccounts(stripeAccountId, { limit: 25 });
      const externalAccountById = new Map(
        externalAccounts.data.map((ea) => [ea.id, ea]),
      );

      const serializedPayouts = payoutsResponse.data.map((payout) => serializePayout(payout, externalAccountById));

      // For pagination requests skip the heavier account/balance calls — only return payouts and cursor.
      if (isPaginationRequest) {
        return res.status(200).json(ok({
          payouts: serializedPayouts,
          has_more: payoutsResponse.has_more,
          next_cursor: payoutsResponse.data.at(-1)?.id ?? null,
        }));
      }

      const account = await stripe.accounts.retrieve(stripeAccountId);
      const failedPayoutsCount = serializedPayouts.filter((payout) => payout.status === "failed").length;
      const last = payoutsResponse.data.find((p) => p.status !== "canceled") ?? null;

      const inTransit = serializedPayouts
        .filter((payout) => payout.status === "in_transit")
        .sort((left, right) => left.arrival_date - right.arrival_date)[0] ?? null;

      const balance = await stripe.balance.retrieve({}, { stripeAccount: stripeAccountId });
      const pendingPayoutTotal = (balance.pending ?? [])
        .filter((entry) => entry.currency === account.default_currency)
        .reduce((sum, entry) => sum + entry.amount, 0);

      return res.status(200).json(ok({
        connected: true,
        payouts_enabled: account.payouts_enabled ?? false,
        payout_schedule: account.settings?.payouts?.schedule ?? null,
        last_payout: last ? { id: last.id, amount: last.amount, currency: last.currency, arrival_date: last.arrival_date, status: last.status, created: last.created } : null,
        next_payout: inTransit
          ? {
              id: inTransit.id,
              amount: inTransit.amount,
              currency: inTransit.currency,
              arrival_date: inTransit.arrival_date,
              status: inTransit.status,
              created: inTransit.created,
            }
          : null,
        pending_payout_total: pendingPayoutTotal,
        pending_currency: account.default_currency,
        failed_payouts_count: failedPayoutsCount,
        disabled_reason: account.requirements?.disabled_reason ?? null,
        payouts: serializedPayouts,
        has_more: payoutsResponse.has_more,
        next_cursor: payoutsResponse.data.at(-1)?.id ?? null,
        external_accounts: externalAccounts.data.map((externalAccount) => ({
          id: externalAccount.id,
          object: externalAccount.object,
          default_for_currency: externalAccount.default_for_currency,
          currency: externalAccount.currency,
          country: externalAccount.country,
          bank_name: externalAccount.object === "bank_account" ? externalAccount.bank_name : null,
          brand: externalAccount.object === "card" ? externalAccount.brand : null,
          last4: externalAccount.last4,
          status: externalAccount.object === "bank_account" ? externalAccount.status : null,
        })),
      }));
    }

    if (body.action === "disputes_list") {
      const stripeAccountId = await requireStripeAccount(store.storeId);
      const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 50);
      const disputes = await stripe.disputes.list({ limit, expand: ["data.charge"] }, { stripeAccount: stripeAccountId });
      return res.status(200).json(ok({
        disputes: disputes.data.map((dispute) => {
          const chargeFields = extractChargeFields(dispute.charge);
          return {
            id: dispute.id,
            amount: dispute.amount,
            currency: dispute.currency,
            status: dispute.status,
            reason: dispute.reason,
            created: dispute.created,
            charge: typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null,
            payment_intent: typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id ?? null,
            customer_name: dispute.evidence?.customer_name ?? null,
            payment_method_last4: chargeFields.payment_method_last4,
            payment_method_brand: chargeFields.payment_method_brand,
            notes: dispute.evidence?.uncategorized_text ?? null,
            stripe_dashboard_url: `https://dashboard.stripe.com/disputes/${dispute.id}`,
            evidence_details: {
              due_by: dispute.evidence_details?.due_by ?? null,
              has_evidence: dispute.evidence_details?.has_evidence ?? false,
              submission_count: dispute.evidence_details?.submission_count ?? 0,
            },
          };
        }),
      }));
    }

    if (body.action === "disputes_submit_evidence") {
      const stripeAccountId = await requireStripeAccount(store.storeId);
      if (!canRespondToDispute(store.role)) {
        return res.status(403).json(fail("FORBIDDEN", "Your role does not have permission to submit dispute evidence."));
      }

      const disputeId = String(body.disputeId ?? "").trim();
      const notes = String(body.notes ?? "").trim();
      if (!disputeId) return res.status(400).json(fail("VALIDATION_ERROR", "Missing disputeId"));
      if (!notes) return res.status(400).json(fail("VALIDATION_ERROR", "Evidence notes are required"));

      // Optional supporting-file list: callers upload files elsewhere (e.g. to
      // Stripe Files API or Supabase Storage) and pass the resulting file IDs
      // here. We attach known Stripe evidence fields and store the audit copy.
      const rawFiles = Array.isArray(body.files) ? body.files : [];
      const evidenceFiles = rawFiles
        .map((f) => (typeof f === "string" ? f.trim() : ""))
        .filter((f): f is string => f.length > 0);

      const evidencePayload: Stripe.DisputeUpdateParams.Evidence = {
        uncategorized_text: notes,
      };
      // Stripe accepts a handful of typed file fields. We map the first few
      // supplied IDs to the documented evidence slots; callers can override by
      // passing a structured `evidence` object instead.
      if (evidenceFiles[0]) evidencePayload.receipt = evidenceFiles[0];
      if (evidenceFiles[1]) evidencePayload.customer_communication = evidenceFiles[1];
      if (evidenceFiles[2]) evidencePayload.service_documentation = evidenceFiles[2];

      const structuredEvidence =
        typeof body.evidence === "object" && body.evidence !== null
          ? (body.evidence as Stripe.DisputeUpdateParams.Evidence)
          : null;

      const dispute = await stripe.disputes.update(
        disputeId,
        {
          evidence: { ...evidencePayload, ...(structuredEvidence ?? {}) },
          submit: true,
          metadata: { salonId: store.storeId, actorUserId: store.userId, actorRole: store.role },
        },
        { stripeAccount: stripeAccountId },
      );

      // Audit log — only after Stripe has accepted the submission. This is
      // what drives the in-app status history for the dispute.
      try {
        const sb = getSupabaseAdmin();
        await sb.from("dispute_evidence_submissions").insert({
          store_id: store.storeId,
          stripe_dispute_id: disputeId,
          actor_user_id: store.userId,
          actor_role: store.role,
          notes,
          evidence: {
            files: evidenceFiles,
            ...(structuredEvidence ?? {}),
          },
        });
      } catch {
        // Never fail the user action because audit logging hiccupped — the
        // evidence is already in Stripe at this point.
      }

      return res.status(200).json(ok({ dispute }));
    }

    return res.status(400).json(fail("VALIDATION_ERROR", `Unknown action: ${body.action}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connect action failed";
    const status = message.startsWith("UNAUTHORIZED") ? 401 : message.startsWith("FORBIDDEN") || message.startsWith("MISSING_") ? 403 : 500;
    return res.status(status).json(fail("CONNECT_ERROR", message));
  }
}
