import { getJSON, postJSON } from "@/stripe/api";

export interface StripeSaleLineItem {
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
  items?: StripeSaleLineItem[];
  checkoutSessionId?: string | null;
}

export interface StripeConnectHealth {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
  requirements_due: string[];
  disabled_reason?: string | null;
  stripe_card_setup_status?: "not_set_up" | "pending" | "active" | "restricted";
  stripe_account_id: string | null;
  storeId: string;
  last_webhook_sync_at: string | null;
}


export interface StripePayoutExternalAccount {
  id: string
  object: 'bank_account' | 'card'
  default_for_currency: boolean | null
  currency: string | null
  country: string | null
  bank_name: string | null
  brand: string | null
  last4: string | null
  status: string | null
}

export interface StripePayoutDestinationSummary {
  id: string
  object: 'bank_account' | 'card'
  bank_name: string | null
  brand: string | null
  country: string | null
  currency: string | null
  last4: string | null
  status: string | null
}

export interface StripePayout {
  id: string
  amount: number
  currency: string
  created: number
  arrival_date: number
  status: string
  method: string
  type: string
  statement_descriptor: string | null
  description: string | null
  failure_code: string | null
  failure_message: string | null
  destination_id: string | null
  destination_type: string | null
  destination_label: string | null
  destination_summary: StripePayoutDestinationSummary | null
  balance_transaction_id: string | null
  fees: number | null
  gross_amount: number
  net_amount: number
}

export interface StripePayoutsResponse {
  connected: boolean
  payouts_enabled: boolean
  payout_schedule: { interval?: string; delay_days?: number } | null
  last_payout: { id: string; amount: number; currency: string; arrival_date: number; status: string; created: number } | null
  next_payout: { id: string; amount: number; currency: string; arrival_date: number; status: string; created: number } | null
  pending_payout_total: number
  pending_currency: string | null
  failed_payouts_count: number
  disabled_reason: string | null
  payouts: StripePayout[]
  has_more: boolean
  next_cursor: string | null
  external_accounts: StripePayoutExternalAccount[]
}

export interface StripeSaleFinalizeResponse {
  finalized: boolean;
  alreadyFinalized: boolean;
  storeId: string;
  receiptId: string;
  transactionId: string;
  appointmentId: string | null;
}

function checkoutQuery(sessionId: string, token: string) {
  const params = new URLSearchParams({
    session_id: sessionId,
    token,
  });
  return `/api/stripe/checkout?${params.toString()}`;
}

export const paymentClient = {
  createIntent: (amountCents: number, description?: string, localMetadata?: StripeSaleMetadata) =>
    postJSON<{ clientSecret: string; paymentIntentId: string }>("/api/stripe/payments", {
      action: "create_intent",
      amountCents,
      description,
      localMetadata,
    }),
  createPaymentLink: (amountCents: number, description?: string, localMetadata?: StripeSaleMetadata) =>
    postJSON<{ url: string; sessionId: string; internalTransactionId: string }>("/api/stripe/payments", {
      action: "create_checkout_link",
      amountCents,
      description,
      localMetadata,
    }),
  captureIntent: (paymentIntentId: string) =>
    postJSON<{ paymentIntentId: string; status: string }>("/api/stripe/payments", { action: "capture", paymentIntentId }),
  createRefund: (paymentIntentId: string, amountCents: number, reasonCode?: string) =>
    postJSON<{ id: string; amount: number; status: string }>("/api/stripe/payments", {
      action: "refund_create",
      paymentIntentId,
      amountCents,
      reasonCode,
    }),
  getIntent: (paymentIntentId: string) =>
    postJSON<{ paymentIntent: { id: string; status: string; latest_charge?: string | null } }>("/api/stripe/payments", {
      action: "get_intent",
      paymentIntentId,
    }),
  finalizeSale: (paymentIntentId: string) =>
    postJSON<StripeSaleFinalizeResponse>("/api/stripe/payments", { action: "finalize_sale", paymentIntentId }),
  terminalConnectionToken: (locationId?: string) =>
    postJSON<{ secret: string }>("/api/stripe/terminal", { action: "connection_token", locationId }),
  ensureTerminalLocation: () =>
    postJSON<{ locationId: string | null; label: string | null }>("/api/stripe/terminal", { action: "location_get" }),
  createTerminalLocation: (displayName?: string) =>
    postJSON<{ locationId: string; label: string | null; created: boolean }>("/api/stripe/terminal", { action: "location_create", displayName }),
  setTerminalLocation: (locationId: string, label?: string) =>
    postJSON<{ locationId: string; label: string | null }>("/api/stripe/terminal", { action: "location_set", locationId, label }),
  saveTerminalReader: (reader: { readerId: string; label?: string; deviceType?: string; status?: string }) =>
    postJSON<{ readerId: string }>("/api/stripe/terminal", { action: "reader_save", ...reader }),
  createTerminalIntent: (amountCents: number, currency = "usd", localMetadata?: StripeSaleMetadata) =>
    postJSON<{ client_secret: string; payment_intent_id: string }>("/api/stripe/terminal", {
      action: "payment_intents",
      amountCents,
      currency,
      localMetadata,
    }),
  stripeStatus: () => postJSON<StripeConnectHealth>("/api/stripe/connect", { action: "status" }),
  stripeHealth: () => postJSON<StripeConnectHealth>("/api/stripe/connect", { action: "health" }),
  ensureConnectAccount: (country = "US") =>
    postJSON<{ connectedAccountId: string }>("/api/stripe/connect", { action: "accounts", country }),
  accountSession: () => postJSON<{ client_secret: string; documents_required?: boolean; documents_warning?: string }>("/api/stripe/connect", { action: "account_session" }),
  getPosSettings: () => postJSON<{ settings: Record<string, unknown> }>("/api/stripe/settings", { action: "pos_get" }),
  setPosSettings: (partialSettings: Record<string, unknown>) =>
    postJSON<{ settings: Record<string, unknown> }>("/api/stripe/settings", { action: "pos_set", partialSettings }),
  listDisputes: (limit = 10) => postJSON<{ disputes: unknown[] }>("/api/stripe/connect", { action: "disputes_list", limit }),
  submitDisputeEvidence: (disputeId: string, notes: string) =>
    postJSON<{ dispute: unknown }>("/api/stripe/connect", { action: "disputes_submit_evidence", disputeId, notes }),
  payoutSummary: () => postJSON<unknown>("/api/stripe/connect", { action: "payout_summary" }),
  listPayouts: (limit = 20, starting_after?: string) =>
    postJSON<StripePayoutsResponse>("/api/stripe/connect", { action: "payouts_list", limit, starting_after }),
  listPayments: () => getJSON<{ payments: unknown[] }>("/api/stripe/payments?list=1"),
  resolveCheckoutSession: (sessionId: string, token: string) =>
    getJSON<{ paid: boolean; finalized: boolean; receiptId: string | null; storeId: string; appointmentId: string | null }>(checkoutQuery(sessionId, token)),
  // Platform SaaS billing (separate from connected-account POS payments)
  getPlatformSubscription: () =>
    postJSON<{ subscription: Record<string, unknown> | null }>("/api/stripe/billing", { action: "get_subscription" }),
  createPlatformBillingCheckout: () =>
    postJSON<{ url: string | null }>("/api/stripe/billing", { action: "create_checkout_session" }),
  createPlatformBillingPortal: () =>
    postJSON<{ url: string | null }>("/api/stripe/billing", { action: "create_billing_portal" }),
};
