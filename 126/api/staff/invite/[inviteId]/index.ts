import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleInviteLookup } from "../../../_shared/inviteShared.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use GET" });
  }

  const inviteIdParam = req.query.inviteId;
  const inviteId = Array.isArray(inviteIdParam) ? inviteIdParam[0] : inviteIdParam;

  if (!inviteId || !UUID_REGEX.test(inviteId)) {
    return res
      .status(400)
      .json({ error: "VALIDATION_ERROR", message: "A valid invite token is required." });
  }

  return handleInviteLookup(req, res, inviteId);
}
