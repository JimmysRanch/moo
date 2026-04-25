import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const SERVICE_ROLE_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE",
  "SERVICE_ROLE_KEY",
] as const;

const DEPLOYED_ENVS = new Set(["production", "preview"]);

export function resolveSupabaseCredentials(env: NodeJS.ProcessEnv = process.env) {
  return {
    supabaseUrl: env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey:
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_SERVICE_KEY ||
      env.SUPABASE_SERVICE_ROLE ||
      env.SERVICE_ROLE_KEY,
  };
}

export function resolveInviteBaseUrl(env: NodeJS.ProcessEnv = process.env, requestOrigin?: string) {
  const vercelEnv = env.VERCEL_ENV?.toLowerCase();
  const nodeEnv = env.NODE_ENV?.toLowerCase();
  const isDeployed = DEPLOYED_ENVS.has(vercelEnv || "") || nodeEnv === "production";

  if (isDeployed) {
    return env.APP_BASE_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined);
  }

  return env.APP_BASE_URL || requestOrigin || "http://localhost:5173";
}

export function buildInviteErrorHint(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("not allowed")) {
    return "Server is not using service role key. Check SUPABASE_SERVICE_ROLE_KEY in Vercel env.";
  }

  if (normalizedMessage.includes("redirect") || normalizedMessage.includes("url")) {
    return "Redirect URL not allowed. Check Supabase Auth Redirect URLs and APP_BASE_URL.";
  }

  return "Check server logs for invite email provider and Supabase auth errors.";
}

export function buildInviteRedirectTo(baseUrl: string, inviteId: string) {
  const callbackUrl = new URL("/auth/callback", baseUrl);
  return `${callbackUrl.origin}${callbackUrl.pathname}?next=${encodeURIComponent(`/onboarding/staff?token=${inviteId}`)}`;
}

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  groomer: "Groomer",
  front_desk: "Front Desk",
  bather: "Bather",
  staff: "Front Desk",
};

type InviteCompensation = {
  hourly_rate?: number | null;
  commission_percentage?: number | null;
  service_commission_overrides?: Record<string, number>;
};

type InviteSchedule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

type InviteLookupRecord = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  hire_date?: string | null;
};

async function getAuthedClients(req: VercelRequest, res: VercelResponse, context: "INVITE_FETCH_FAILED" | "INVITE_ACCEPT_FAILED") {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : undefined;

  if (!accessToken) {
    res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Missing access token." });
    return null;
  }

  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = resolveSupabaseCredentials();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    console.error(`Missing Supabase credentials for invite endpoint. Checked service role env vars: ${SERVICE_ROLE_ENV_NAMES.join(", ")}`);
    res.status(500).json({ error: context, message: "Server configuration error." });
    return null;
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Invalid or expired session." });
    return null;
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { userClient, adminClient, user };
}

export async function handleInviteLookup(req: VercelRequest, res: VercelResponse, inviteId: string) {
  const ctx = await getAuthedClients(req, res, "INVITE_FETCH_FAILED");
  if (!ctx) return;

  const { data: invite, error } = await ctx.adminClient
    .from("staff_invites")
    .select("id,email,role,status,expires_at,hire_date")
    .eq("id", inviteId)
    .single<InviteLookupRecord>();

  if (error || !invite) {
    return res.status(404).json({ error: "INVITE_NOT_FOUND", message: "Invite not found." });
  }

  if (invite.status !== "pending") {
    return res.status(409).json({ error: "INVITE_NOT_PENDING", message: "This invite has already been processed.", invite });
  }

  if (new Date(invite.expires_at) <= new Date()) {
    await ctx.adminClient.from("staff_invites").update({ status: "expired" }).eq("id", invite.id).eq("status", "pending");
    return res.status(410).json({ error: "INVITE_EXPIRED", message: "This invite has expired. Please ask the owner to resend it." });
  }


  return res.status(200).json({
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expires_at: invite.expires_at,
      hire_date: invite.hire_date,
    },
  });
}

export async function handleAcceptInvite(req: VercelRequest, res: VercelResponse) {
  const { inviteId, profile } = (req.body ?? {}) as {
    inviteId?: string;
    profile?: {
      first_name?: string;
      last_name?: string;
      phone?: string;
      address?: {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
      };
      emergency_contact_name?: string;
      emergency_contact_relation?: string;
      emergency_contact_phone?: string;
      notes?: string;
      email?: string;
    };
  };

  if (!inviteId) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Invite ID is required." });
  }

  const ctx = await getAuthedClients(req, res, "INVITE_ACCEPT_FAILED");
  if (!ctx) return;

  const { data: invite, error: fetchError } = await ctx.adminClient
    .from("staff_invites")
    .select("*")
    .eq("id", inviteId)
    .single();

  if (fetchError || !invite) {
    return res.status(404).json({ error: "INVITE_NOT_FOUND", message: "Invite not found." });
  }

  if (invite.status === "accepted") {
    const { data: existingStaff } = await ctx.adminClient
      .from("staff")
      .select("id")
      .eq("store_id", invite.store_id)
      .eq("user_id", ctx.user.id)
      .single();

    return res.status(200).json({ storeId: invite.store_id, staffId: existingStaff?.id, alreadyAccepted: true });
  }

  if (invite.status !== "pending") {
    return res.status(409).json({ error: "INVITE_NOT_PENDING", message: "This invite can no longer be accepted." });
  }

  if (new Date(invite.expires_at) <= new Date()) {
    await ctx.adminClient.from("staff_invites").update({ status: "expired" }).eq("id", invite.id).eq("status", "pending");
    return res.status(410).json({ error: "INVITE_EXPIRED", message: "This invite has expired. Please ask the owner to resend it." });
  }

  const { error: membershipError } = await ctx.adminClient
    .from("store_memberships")
    .upsert(
      {
        store_id: invite.store_id,
        user_id: ctx.user.id,
        role: invite.role,
      },
      { onConflict: "store_id,user_id", ignoreDuplicates: false }
    );

  if (membershipError) {
    console.error("Failed to create membership during invite acceptance", membershipError);
    return res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to add store membership." });
  }

  const staffPayload = {
    store_id: invite.store_id,
    user_id: ctx.user.id,
    first_name: profile?.first_name?.trim() || invite.email.split("@")[0],
    last_name: profile?.last_name?.trim() || "",
    email: profile?.email || invite.email,
    phone: profile?.phone?.trim() || null,
    address: profile?.address ?? null,
    emergency_contact_name: profile?.emergency_contact_name?.trim() || null,
    emergency_contact_relation: profile?.emergency_contact_relation?.trim() || null,
    emergency_contact_phone: profile?.emergency_contact_phone?.trim() || null,
    notes: profile?.notes?.trim() || null,
    role: ROLE_LABELS[invite.role] ?? invite.role,
    status: "active",
    is_groomer: invite.role === "groomer",
    hire_date: invite.hire_date ?? null,
  };

  const { data: staffRow, error: staffError } = await ctx.adminClient
    .from("staff")
    .upsert(staffPayload, { onConflict: "store_id,user_id" })
    .select("id")
    .single();

  if (staffError || !staffRow) {
    console.error("Failed to upsert staff during invite acceptance", staffError);
    return res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to create staff profile." });
  }

  if (invite.compensation && typeof invite.compensation === "object") {
    const payload = invite.compensation as InviteCompensation;
    const { error: compensationError } = await ctx.adminClient
      .from("staff_compensation")
      .upsert({
        store_id: invite.store_id,
        staff_id: staffRow.id,
        hourly_rate: payload.hourly_rate ?? 0,
        commission_percentage: payload.commission_percentage ?? 0,
        service_commission_overrides: payload.service_commission_overrides ?? {},
        updated_by: ctx.user.id,
      }, { onConflict: "staff_id" });

    if (compensationError) {
      console.error("Failed to upsert compensation during invite acceptance", compensationError);
      return res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to save compensation details." });
    }
  }

  if (Array.isArray(invite.schedules) && invite.schedules.length > 0) {
    const schedulesPayload = invite.schedules as InviteSchedule[];

    const { error: deleteScheduleError } = await ctx.adminClient
      .from("staff_schedules")
      .delete()
      .eq("store_id", invite.store_id)
      .eq("staff_id", staffRow.id);

    if (deleteScheduleError) {
      console.error("Failed to clear schedules during invite acceptance", deleteScheduleError);
      return res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to save schedule details." });
    }

    const { error: insertScheduleError } = await ctx.adminClient
      .from("staff_schedules")
      .insert(
        schedulesPayload.map((schedule) => ({
          store_id: invite.store_id,
          staff_id: staffRow.id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          is_available: schedule.is_available,
        }))
      );

    if (insertScheduleError) {
      console.error("Failed to insert schedules during invite acceptance", insertScheduleError);
      return res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to save schedule details." });
    }
  }

  const { error: updateInviteError } = await ctx.adminClient
    .from("staff_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: ctx.user.id })
    .eq("id", invite.id)
    .eq("status", "pending");

  if (updateInviteError) {
    console.error("Failed to mark invite accepted", updateInviteError);
    return res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to complete invite acceptance." });
  }

  return res.status(200).json({ storeId: invite.store_id, staffId: staffRow.id });
}
