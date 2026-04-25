import { Actor, roleTier } from "./roles.js";
import { errorResponse, ApiError } from "./stripeServer.js";

// ── Refund policy types ──────────────────────────────────────────────────────

export interface RefundBreakdown {
  serviceAmount: number;
  tipAmount: number;
  taxAmount: number;
}

export interface RefundPolicyInput {
  actor: Actor;
  amount: number;
  breakdown: RefundBreakdown;
  notes?: string;
  originalPaymentCreatedAt: number; // epoch ms
  paymentMethod: "card" | "cash";
  refundMethod?: "card" | "cash"; // how refund is issued; default = same as payment
}

// ── Policy enforcement ───────────────────────────────────────────────────────

export function enforceRefundPolicy(input: RefundPolicyInput): ApiError | null {
  const { actor, amount, breakdown, notes, originalPaymentCreatedAt, paymentMethod, refundMethod } = input;
  const role = actor.role;
  const tier = roleTier(role);
  const now = Date.now();
  const ageMs = now - originalPaymentCreatedAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Card-to-cash requires Owner/Admin
  if (paymentMethod === "card" && refundMethod === "cash" && tier < 2) {
    return errorResponse(
      "REFUND_BLOCKED",
      "Card-to-cash refunds require Owner or Admin role"
    );
  }

  // Tip refunds: only Manager+ allowed
  if (breakdown.tipAmount > 0 && tier < 1) {
    return errorResponse(
      "REFUND_BLOCKED",
      "Tip refunds are not allowed for Staff/Front Desk"
    );
  }

  // If tip refund, notes are required (Manager+)
  if (breakdown.tipAmount > 0 && (!notes || notes.trim().length === 0)) {
    return errorResponse(
      "REFUND_BLOCKED",
      "Notes are required when refunding tips"
    );
  }

  // Staff / Front Desk limits
  if (tier === 0) {
    // Service refunds only (no tip)
    if (breakdown.tipAmount > 0) {
      return errorResponse("REFUND_BLOCKED", "Tip refunds are not allowed for Staff/Front Desk");
    }

    // Max $100
    if (amount > 10000) {
      return errorResponse("REFUND_BLOCKED", "Staff/Front Desk refund limit is $100.00");
    }

    // Same-day only
    if (ageDays >= 1) {
      return errorResponse("REFUND_BLOCKED", "Staff/Front Desk can only refund same-day transactions");
    }
  }

  // Manager limits
  if (tier === 1) {
    // Max $500
    if (amount > 50000) {
      return errorResponse("REFUND_BLOCKED", "Manager refund limit is $500.00");
    }

    // Within 30 days
    if (ageDays > 30) {
      return errorResponse("REFUND_BLOCKED", "Manager can only refund transactions within 30 days");
    }
  }

  // Owner/Admin: unlimited, any time window — no additional checks

  return null; // allowed
}
