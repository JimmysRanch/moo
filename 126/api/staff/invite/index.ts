import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  buildInviteErrorHint,
  buildInviteRedirectTo,
  handleInviteLookup,
  resolveInviteBaseUrl,
  resolveSupabaseCredentials,
  SERVICE_ROLE_ENV_NAMES,
} from "../../_shared/inviteShared.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(["manager", "groomer", "front_desk", "bather", "staff"] as const);

type StaffRole = "manager" | "groomer" | "front_desk" | "bather" | "staff";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    const idParam = req.query.id;
    const inviteId = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!inviteId || !UUID_REGEX.test(inviteId)) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "A valid invite token is required." });
    }
    return handleInviteLookup(req, res, inviteId);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use POST" });
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // If inviteId is present (without email), this is a resend request
    if (body.inviteId && !body.email) {
      return handleResend(req, res, body.inviteId as string);
    }

    // Cancel an existing pending invite
    if (body.cancelInviteId && !body.email) {
      return handleCancel(req, res, body.cancelInviteId as string);
    }

    return handleCreate(req, res);
  } catch (error) {
    console.error("staff invite api error:", error);
    return res.status(500).json({ error: "INVITE_FAILED", message: "Internal server error." });
  }
}

async function handleCreate(req: VercelRequest, res: VercelResponse) {
  const { email, role, expiresAt, hireDate, startDate, compensation, schedules } = (req.body ?? {}) as {
    email?: string;
    role?: StaffRole;
    expiresAt?: string;
    hireDate?: string;
    startDate?: string;
    compensation?: Record<string, unknown>;
    schedules?: Array<Record<string, unknown>>;
  };

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "A valid email is required." });
  }

  if (!role || !ALLOWED_ROLES.has(role)) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "A valid staff role is required." });
  }

  const normalizedRole = role === "staff" ? "front_desk" : role;

  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : undefined;

  if (!accessToken) {
    return res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Missing access token." });
  }

  const storeId = req.headers["x-store-id"];
  const normalizedStoreId = Array.isArray(storeId) ? storeId[0] : storeId;
  if (!normalizedStoreId) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing store context." });
  }

  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = resolveSupabaseCredentials();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase URL or anon key for staff invite endpoint");
    return res.status(500).json({ error: "INVITE_FAILED", message: "Server configuration error." });
  }

  if (!supabaseServiceRoleKey) {
    console.error(`Missing service role key for staff invite endpoint. Checked env vars: ${SERVICE_ROLE_ENV_NAMES.join(", ")}`);
    return res.status(500).json({
      error: "SERVER_CONFIG",
      message: "Missing SUPABASE_SERVICE_ROLE_KEY (service role key) on server.",
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Invalid or expired session." });
  }

  const expiresAtValue = expiresAt && !Number.isNaN(Date.parse(expiresAt))
    ? new Date(expiresAt).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const normalizedHireDate = hireDate || startDate;

  const { data: invite, error: insertError } = await userClient
    .from("staff_invites")
    .insert({
      store_id: normalizedStoreId,
      email: normalizedEmail,
      role: normalizedRole,
      status: "pending",
      invited_by: user.id,
      expires_at: expiresAtValue,
      hire_date: normalizedHireDate ?? null,
      compensation: compensation ?? null,
      schedules: schedules ?? null,
    })
    .select("*")
    .single();

  if (insertError || !invite) {
    console.error("Failed to persist staff invite", insertError);
    return res.status(500).json({
      error: "INVITE_FAILED",
      message: insertError?.message || "Failed to create invitation record.",
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  const baseUrl = resolveInviteBaseUrl(process.env, originHeader);
  if (!baseUrl) {
    return res.status(500).json({
      error: "SERVER_CONFIG",
      message: "Missing APP_BASE_URL on server.",
    });
  }
  const redirectTo = buildInviteRedirectTo(baseUrl, invite.id);

  const { error: emailError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo,
    data: {
      store_id: normalizedStoreId,
      staff_invite_id: invite.id,
      staff_invite_token: invite.id,
      new_invite_id: invite.id,
      invited_role: normalizedRole,
    },
  });

  if (emailError) {
    console.error("Failed to send staff invite email", emailError);
    const { error: updateError } = await userClient
      .from("staff_invites")
      .update({ status: "cancelled" })
      .eq("id", invite.id)
      .eq("store_id", normalizedStoreId)
      .eq("status", "pending");
    if (updateError) {
      console.error("Failed to cancel staff invite after email failure", {
        inviteId: invite.id,
        storeId: normalizedStoreId,
        error: updateError,
      });
    }
    return res.status(500).json({
      error: "INVITE_EMAIL_FAILED",
      message: emailError.message || "Failed to send invitation email.",
      hint: buildInviteErrorHint(emailError.message || ""),
    });
  }

  return res.status(200).json({ invite });
}


async function handleCancel(req: VercelRequest, res: VercelResponse, inviteId: string) {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : undefined;

  if (!accessToken) {
    return res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Missing access token." });
  }

  const storeId = req.headers["x-store-id"];
  const normalizedStoreId = Array.isArray(storeId) ? storeId[0] : storeId;
  if (!normalizedStoreId) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing store context." });
  }

  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = resolveSupabaseCredentials();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return res.status(500).json({ error: "SERVER_CONFIG", message: "Server configuration error." });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Invalid or expired session." });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: membership, error: membershipError } = await adminClient
    .from("store_memberships")
    .select("role")
    .eq("store_id", normalizedStoreId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return res.status(500).json({ error: "INVITE_CANCEL_FAILED", message: "Failed to verify permissions." });
  }

  if (!membership || !["owner", "manager"].includes(String(membership.role))) {
    return res.status(403).json({ error: "FORBIDDEN", message: "You do not have permission to cancel invites." });
  }

  const { data: cancelledInvite, error: updateError } = await adminClient
    .from("staff_invites")
    .update({ status: "cancelled" })
    .eq("id", inviteId)
    .eq("store_id", normalizedStoreId)
    .eq("status", "pending")
    .select("id,status")
    .maybeSingle();

  if (updateError) {
    return res.status(500).json({ error: "INVITE_CANCEL_FAILED", message: "Failed to cancel invite." });
  }

  if (!cancelledInvite) {
    return res.status(404).json({ error: "INVITE_NOT_FOUND", message: "Invite not found or already processed." });
  }

  return res.status(200).json({ invite: cancelledInvite });
}

async function handleResend(req: VercelRequest, res: VercelResponse, inviteId: string) {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : undefined;

  if (!accessToken) {
    return res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Missing access token." });
  }

  const storeId = req.headers["x-store-id"];
  const normalizedStoreId = Array.isArray(storeId) ? storeId[0] : storeId;
  if (!normalizedStoreId) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing store context." });
  }

  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = resolveSupabaseCredentials();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase URL or anon key for staff invite endpoint");
    return res.status(500).json({ error: "SERVER_CONFIG", message: "Server configuration error." });
  }

  if (!supabaseServiceRoleKey) {
    console.error(`Missing service role key. Checked: ${SERVICE_ROLE_ENV_NAMES.join(", ")}`);
    return res.status(500).json({
      error: "SERVER_CONFIG",
      message: "Missing SUPABASE_SERVICE_ROLE_KEY (service role key) on server.",
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Invalid or expired session." });
  }

  const { data: invite, error: fetchError } = await userClient
    .from("staff_invites")
    .select("id, email, role, store_id, status")
    .eq("id", inviteId)
    .eq("store_id", normalizedStoreId)
    .single();

  if (fetchError || !invite) {
    return res.status(404).json({ error: "INVITE_NOT_FOUND", message: "Invite not found." });
  }

  if (invite.status !== "pending") {
    return res.status(409).json({ error: "INVITE_NOT_PENDING", message: "Only pending invites can be emailed." });
  }

  const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  const baseUrl = resolveInviteBaseUrl(process.env, originHeader);
  if (!baseUrl) {
    return res.status(500).json({ error: "SERVER_CONFIG", message: "Missing APP_BASE_URL on server." });
  }
  const redirectTo = buildInviteRedirectTo(baseUrl, invite.id);

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: emailError } = await adminClient.auth.admin.inviteUserByEmail(invite.email, {
    redirectTo,
    data: {
      store_id: normalizedStoreId,
      staff_invite_id: invite.id,
      staff_invite_token: invite.id,
      new_invite_id: invite.id,
      invited_role: invite.role,
    },
  });

  if (emailError) {
    console.error("Failed to send staff invite email", emailError);
    return res.status(500).json({
      error: "INVITE_EMAIL_FAILED",
      message: emailError.message || "Failed to send invitation email.",
      hint: buildInviteErrorHint(emailError.message || ""),
    });
  }

  return res.status(200).json({ success: true });
}
