import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveStore, getPaymentSettings, patchPaymentSettings, ok, fail } from "./_lib.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json(fail("METHOD_NOT_ALLOWED", "Use POST"));

  try {
    const body = (req.body ?? {}) as { action?: string; settings?: Record<string, unknown>; partialSettings?: Record<string, unknown> };
    if (!body.action) return res.status(400).json(fail("VALIDATION_ERROR", "Missing action"));

    const store = await resolveStore(req);
    const storeId = store.storeId;

    /* ── Settings actions ── */
    if (body.action === "pos_get") return res.status(200).json(ok({ settings: await getPaymentSettings(storeId, "pos") }));
    if (body.action === "card_get") return res.status(200).json(ok({ settings: await getPaymentSettings(storeId, "card") }));
    if (body.action === "pos_set") {
      const patch = body.partialSettings ?? body.settings;
      if (!patch) return res.status(400).json(fail("VALIDATION_ERROR", "settings or partialSettings is required"));
      return res.status(200).json(ok({ settings: await patchPaymentSettings(storeId, "pos", patch) }));
    }
    if (body.action === "card_set") {
      const patch = body.partialSettings ?? body.settings;
      if (!patch) return res.status(400).json(fail("VALIDATION_ERROR", "settings or partialSettings is required"));
      return res.status(200).json(ok({ settings: await patchPaymentSettings(storeId, "card", patch) }));
    }

    return res.status(400).json(fail("VALIDATION_ERROR", `Unknown action: ${body.action}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settings action failed";
    const status = message.startsWith("UNAUTHORIZED") ? 401 : message.startsWith("FORBIDDEN") || message.startsWith("MISSING_") ? 403 : 500;
    return res.status(status).json(fail("SETTINGS_ERROR", message));
  }
}
