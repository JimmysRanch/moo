import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getStripe, ok, fail } from "./_lib.js";
import { resolvePublicCheckoutSession } from "./_fulfillment.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json(fail("METHOD_NOT_ALLOWED", "Use GET"));

  try {
    const sessionId = typeof req.query.session_id === "string" ? req.query.session_id.trim() : "";
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    if (!sessionId || !token) {
      return res.status(400).json(fail("VALIDATION_ERROR", "session_id and token are required"));
    }

    const stripe = getStripe();
    const result = await resolvePublicCheckoutSession(stripe, sessionId, token);
    return res.status(200).json(ok(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout resolution failed";
    const status = message.startsWith("NOT_FOUND") ? 404 : 500;
    return res.status(status).json(fail("CHECKOUT_ERROR", message));
  }
}
