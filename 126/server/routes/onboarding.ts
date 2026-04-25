import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

export const onboardingRouter = Router();

/**
 * POST /api/onboarding/provision-owner
 * Body: { storeName: string, accessToken: string }
 *
 * Provisions a new store using the atomic RPC function.
 * This ensures single owner per store and never creates partial data.
 */
onboardingRouter.post("/provision-owner", async (req: Request, res: Response) => {
  try {
    const { storeName, accessToken: bodyToken } = req.body as { storeName?: string; accessToken?: string };

    if (!storeName || !storeName.trim()) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Store name is required." });
      return;
    }

    // Accept token from Authorization header (preferred) or body (legacy)
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.replace('Bearer ', '') 
      : bodyToken;

    if (!accessToken) {
      console.error("Missing access token in both Authorization header and request body");
      res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Missing access token." });
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("Provisioning store:", storeName, "| Token source:", authHeader ? "header" : "body");
    }

    // Create a Supabase client with the user's access token
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase credentials");
      res.status(500).json({ error: "PROVISIONING_FAILED", message: "Server configuration error." });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    // Verify the user's authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Invalid or expired session." });
      return;
    }

    // Call the RPC function
    const { data: storeId, error: rpcError } = await supabase
      .rpc("provision_owner_store", { p_store_name: storeName.trim() });

    if (rpcError) {
      console.error("RPC error:", rpcError);
      
      // Map PostgreSQL exceptions to API error codes
      if (rpcError.message?.includes("NOT_AUTHENTICATED")) {
        res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Authentication required." });
        return;
      }
      if (rpcError.message?.includes("VALIDATION_ERROR")) {
        res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid store name." });
        return;
      }
      if (rpcError.message?.includes("NEEDS_OWNER_INVITE")) {
        res.status(403).json({ 
          error: "NEEDS_OWNER_INVITE", 
          message: "You are already a staff member at another store. Ask the owner to invite you as an owner, or leave that store first." 
        });
        return;
      }
      if (rpcError.message?.includes("duplicate key") || rpcError.message?.includes("DUPLICATE_MEMBERSHIP")) {
        res.status(409).json({ error: "DUPLICATE_MEMBERSHIP", message: "You are already a member of this store." });
        return;
      }
      if (rpcError.message?.includes("OWNER_ALREADY_EXISTS")) {
        res.status(409).json({ error: "OWNER_ALREADY_EXISTS", message: "This store already has an owner." });
        return;
      }
      
      // Return full error details for debugging
      const errorDetails = process.env.NODE_ENV === 'development' 
        ? { error: "PROVISIONING_FAILED", message: rpcError.message || "Failed to create store.", details: rpcError }
        : { error: "PROVISIONING_FAILED", message: rpcError.message || "Failed to create store." };
      
      res.status(500).json(errorDetails);
      return;
    }

    // RPC returns store_id on both new creation and idempotent case
    res.json({ storeId });
  } catch (err) {
    console.error("provision-owner error:", err);
    res.status(500).json({ error: "PROVISIONING_FAILED", message: "Internal server error." });
  }
});

