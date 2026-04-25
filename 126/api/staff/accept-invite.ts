import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleAcceptInvite } from "../_shared/inviteShared.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  try {
    return await handleAcceptInvite(req, res);
  } catch (error) {
    console.error("staff accept-invite api error:", error);
    return res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Internal server error." });
  }
}
