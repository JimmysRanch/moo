import Stripe from "stripe";

// ── Singleton Stripe client ──────────────────────────────────────────────────
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  _stripe = new Stripe(key, { typescript: true });
  return _stripe;
}

// ── Connected-account scoping ────────────────────────────────────────────────
export function stripeAccountHeader(connectedAccountId: string): { stripeAccount: string } {
  return { stripeAccount: connectedAccountId };
}

// ── Idempotency key helper ───────────────────────────────────────────────────
export function idempotencyKey(deterministicKey: string): { idempotencyKey: string } {
  return { idempotencyKey: deterministicKey };
}

// ── Stable error shape ───────────────────────────────────────────────────────
export interface ApiError {
  ok: false;
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccess {
  ok: true;
  [key: string]: unknown;
}

export function errorResponse(code: string, message: string, details?: unknown): ApiError {
  return { ok: false, code, message, ...(details !== undefined ? { details } : {}) };
}

export function successResponse<T extends Record<string, unknown>>(data: T): T & { ok: true } {
  return { ok: true, ...data };
}

// ── Stripe error → user-safe error mapping ───────────────────────────────────
export function mapStripeError(err: unknown): ApiError {
  if (err instanceof Stripe.errors.StripeError) {
    const codeMap: Record<string, string> = {
      card_declined: "CARD_DECLINED",
      expired_card: "CARD_EXPIRED",
      incorrect_cvc: "INCORRECT_CVC",
      processing_error: "PROCESSING_ERROR",
      resource_missing: "NOT_FOUND",
      invalid_request_error: "INVALID_REQUEST",
    };
    const code = codeMap[err.code ?? ""] ?? "STRIPE_ERROR";
    return errorResponse(code, err.message);
  }
  if (err instanceof Error) {
    return errorResponse("INTERNAL_ERROR", err.message);
  }
  return errorResponse("UNKNOWN_ERROR", "An unexpected error occurred");
}
