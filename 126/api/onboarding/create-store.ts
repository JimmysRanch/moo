import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use POST" });
  }

  try {
    const { storeName, firstName, lastName, email } = (req.body ?? {}) as {
      storeName?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    };

    if (!storeName || !storeName.trim()) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Store name is required." });
    }
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "First name is required." });
    }
    if (!lastName || !lastName.trim()) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Last name is required." });
    }
    if (!email || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "A valid email is required." });
    }

    // Accept token from Authorization header
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : undefined;

    if (!accessToken) {
      return res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Missing access token." });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase credentials");
      return res.status(500).json({ error: "PROVISIONING_FAILED", message: "Server configuration error." });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    // Verify the user's authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Invalid or expired session." });
    }

    // Call the RPC — single atomic operation for store + membership + staff
    const { data, error } = await supabase.rpc("create_store_for_user", {
      p_name: storeName.trim(),
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_email: email.trim(),
    });

    if (error) {
      console.error("create_store_for_user error:", error);

      if (error.message?.includes("NOT_AUTHENTICATED")) {
        return res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Authentication required." });
      }
      if (error.message?.includes("VALIDATION_ERROR")) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid store name." });
      }
      if (error.message?.includes("NEEDS_OWNER_INVITE")) {
        return res.status(403).json({
          error: "NEEDS_OWNER_INVITE",
          message: "You are already a staff member at another store. Ask the owner to invite you as an owner, or leave that store first.",
        });
      }
      if (error.message?.includes("duplicate key") || error.message?.includes("DUPLICATE_MEMBERSHIP")) {
        return res.status(409).json({ error: "DUPLICATE_MEMBERSHIP", message: "You are already a member of this store." });
      }
      if (error.message?.includes("OWNER_ALREADY_EXISTS")) {
        return res.status(409).json({ error: "OWNER_ALREADY_EXISTS", message: "This store already has an owner." });
      }

      return res.status(500).json({ error: "PROVISIONING_FAILED", message: error.message || "Failed to create store." });
    }

    return res.status(200).json({ store_id: data });
  } catch (err) {
    console.error("create_store_for_user error:", err);
    return res.status(500).json({ error: "PROVISIONING_FAILED", message: "Internal server error." });
  }
}
