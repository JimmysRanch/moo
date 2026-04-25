import { Router, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALLOWED_ROLES = new Set(["manager", "groomer", "front_desk", "bather", "staff"] as const);
const ROLE_LABELS: Record<StaffRole, string> = {
  manager: "Manager",
  groomer: "Groomer",
  front_desk: "Front Desk",
  bather: "Bather",
  staff: "Front Desk",
};

type StaffRole = "manager" | "groomer" | "front_desk" | "bather" | "staff";

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

function toSafeBaseUrl(req: Request): string {
  return process.env.APP_BASE_URL || req.headers.origin || "http://localhost:5173";
}

function validateTimeRange(startTime: string, endTime: string): boolean {
  if (!TIME_REGEX.test(startTime) || !TIME_REGEX.test(endTime)) return false;
  return endTime > startTime;
}

function validateCompensation(compensation: InviteCompensation | undefined): string | undefined {
  if (!compensation) return undefined;

  if (compensation.hourly_rate != null && (!Number.isFinite(compensation.hourly_rate) || compensation.hourly_rate < 0)) {
    return "Hourly rate must be a non-negative number.";
  }

  if (
    compensation.commission_percentage != null
    && (!Number.isFinite(compensation.commission_percentage)
      || compensation.commission_percentage < 0
      || compensation.commission_percentage > 100)
  ) {
    return "Commission percentage must be between 0 and 100.";
  }

  if (compensation.service_commission_overrides && typeof compensation.service_commission_overrides !== "object") {
    return "Service commission overrides must be an object.";
  }

  return undefined;
}

function validateSchedules(schedules: InviteSchedule[] | undefined): string | undefined {
  if (!schedules) return undefined;
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return "Schedules must contain at least one day.";
  }

  const daySet = new Set<number>();
  for (const entry of schedules) {
    if (!Number.isInteger(entry.day_of_week) || entry.day_of_week < 0 || entry.day_of_week > 6) {
      return "Schedule day_of_week must be between 0 and 6.";
    }
    if (daySet.has(entry.day_of_week)) {
      return "Schedules cannot contain duplicate day_of_week values.";
    }
    daySet.add(entry.day_of_week);

    if (!validateTimeRange(entry.start_time, entry.end_time)) {
      return "Schedule times must be HH:MM format and end_time must be after start_time.";
    }

    if (typeof entry.is_available !== "boolean") {
      return "Schedule is_available must be a boolean.";
    }
  }

  return undefined;
}

async function getAuthedClients(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : undefined;

  if (!accessToken) {
    res.status(401).json({ error: "NOT_AUTHENTICATED", message: "Missing access token." });
    return null;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    console.error("Missing Supabase credentials for staff invite endpoint");
    res.status(500).json({ error: "INVITE_FAILED", message: "Server configuration error." });
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

export const staffInviteRouter = Router();

staffInviteRouter.post("/invite", async (req: Request, res: Response) => {
  try {
    const { email, role, expiresAt, hireDate, startDate, compensation, schedules } = (req.body ?? {}) as {
      email?: string;
      role?: StaffRole;
      expiresAt?: string;
      hireDate?: string;
      startDate?: string;
      compensation?: InviteCompensation;
      schedules?: InviteSchedule[];
    };

    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "A valid email is required." });
      return;
    }

    if (!role || !ALLOWED_ROLES.has(role)) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "A valid staff role is required." });
      return;
    }

    const normalizedRole = role === "staff" ? "front_desk" : role;

    const compensationError = validateCompensation(compensation);
    if (compensationError) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: compensationError });
      return;
    }

    const schedulesError = validateSchedules(schedules);
    if (schedulesError) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: schedulesError });
      return;
    }

    const normalizedHireDate = hireDate || startDate;
    if (normalizedHireDate && Number.isNaN(Date.parse(normalizedHireDate))) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Hire date must be a valid date." });
      return;
    }

    const ctx = await getAuthedClients(req, res);
    if (!ctx) return;

    const storeId = req.headers["x-store-id"];
    const normalizedStoreId = Array.isArray(storeId) ? storeId[0] : storeId;
    if (!normalizedStoreId) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing store context." });
      return;
    }

    const expiresAtValue = expiresAt && !Number.isNaN(Date.parse(expiresAt))
      ? new Date(expiresAt).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: insertError } = await ctx.userClient
      .from("staff_invites")
      .insert({
        store_id: normalizedStoreId,
        email: normalizedEmail,
        role: normalizedRole,
        status: "pending",
        invited_by: ctx.user.id,
        expires_at: expiresAtValue,
        hire_date: normalizedHireDate ?? null,
        compensation: compensation ?? null,
        schedules: schedules ?? null,
      })
      .select("*")
      .single();

    if (insertError || !invite) {
      console.error("Failed to persist staff invite", insertError);
      res.status(500).json({
        error: "INVITE_FAILED",
        message: insertError?.message || "Failed to create invitation record.",
      });
      return;
    }

    const baseUrl = toSafeBaseUrl(req);
    const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(`/onboarding/staff?token=${invite.id}`)}`;

    const { error: emailError } = await ctx.adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
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
      await ctx.userClient
        .from("staff_invites")
        .delete()
        .eq("id", invite.id)
        .eq("store_id", normalizedStoreId)
        .then(({ error: rollbackError }) => {
          if (rollbackError) console.error("Failed to rollback staff invite record", rollbackError);
        });
      res.status(500).json({
        error: "INVITE_EMAIL_FAILED",
        message: emailError.message || "Failed to send invitation email.",
      });
      return;
    }

    res.status(200).json({ invite });
  } catch (error) {
    console.error("staff invite api error:", error);
    res.status(500).json({ error: "INVITE_FAILED", message: "Internal server error." });
  }
});

staffInviteRouter.get("/invite/:inviteId", async (req: Request, res: Response) => {
  try {
    const inviteId = req.params.inviteId;
    if (!inviteId) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Invite ID is required." });
      return;
    }

    const ctx = await getAuthedClients(req, res);
    if (!ctx) return;

    const { data: invite, error } = await ctx.adminClient
      .from("staff_invites")
      .select("id, store_id, email, role, status, expires_at, hire_date, compensation, schedules, created_at, accepted_at")
      .eq("id", inviteId)
      .single();

    if (error || !invite) {
      res.status(404).json({ error: "INVITE_NOT_FOUND", message: "Invite not found." });
      return;
    }

    if (invite.status !== "pending") {
      res.status(409).json({ error: "INVITE_NOT_PENDING", message: "This invite has already been processed.", invite });
      return;
    }

    if (new Date(invite.expires_at) <= new Date()) {
      await ctx.adminClient.from("staff_invites").update({ status: "expired" }).eq("id", invite.id).eq("status", "pending");
      res.status(410).json({ error: "INVITE_EXPIRED", message: "This invite has expired. Please ask the owner to resend it." });
      return;
    }

    res.status(200).json({ invite });
  } catch (error) {
    console.error("staff invite fetch api error:", error);
    res.status(500).json({ error: "INVITE_FETCH_FAILED", message: "Internal server error." });
  }
});

staffInviteRouter.post("/accept-invite", async (req: Request, res: Response) => {
  try {
    const { inviteId, profile } = (req.body ?? {}) as {
      inviteId?: string;
      profile?: {
        first_name?: string;
        last_name?: string;
        phone?: string;
        address?: { street?: string; city?: string; state?: string; zip?: string };
        emergency_contact_name?: string;
        emergency_contact_relation?: string;
        emergency_contact_phone?: string;
        notes?: string;
      };
    };

    if (!inviteId || !profile?.first_name?.trim() || !profile?.last_name?.trim()) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Invite ID, first name, and last name are required." });
      return;
    }

    const ctx = await getAuthedClients(req, res);
    if (!ctx) return;

    const { data: invite, error: inviteError } = await ctx.adminClient
      .from("staff_invites")
      .select("*")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      res.status(404).json({ error: "INVITE_NOT_FOUND", message: "Invite not found." });
      return;
    }

    if (invite.status === "accepted") {
      const { data: existingStaff } = await ctx.adminClient
        .from("staff")
        .select("id")
        .eq("store_id", invite.store_id)
        .eq("user_id", ctx.user.id)
        .maybeSingle();
      res.status(200).json({ storeId: invite.store_id, staffId: existingStaff?.id ?? null, alreadyAccepted: true });
      return;
    }

    if (invite.status !== "pending") {
      res.status(409).json({ error: "INVITE_NOT_PENDING", message: "This invite has already been processed." });
      return;
    }

    if (new Date(invite.expires_at) <= new Date()) {
      await ctx.adminClient.from("staff_invites").update({ status: "expired" }).eq("id", invite.id).eq("status", "pending");
      res.status(410).json({ error: "INVITE_EXPIRED", message: "This invite has expired. Please ask for a new invite." });
      return;
    }

    if ((ctx.user.email ?? "").trim().toLowerCase() !== String(invite.email ?? "").trim().toLowerCase()) {
      res.status(403).json({ error: "INVITE_EMAIL_MISMATCH", message: "You must sign in with the invited email to accept this invite." });
      return;
    }

    const membershipPayload = {
      store_id: invite.store_id,
      user_id: ctx.user.id,
      role: invite.role,
    };

    const { error: membershipError } = await ctx.adminClient
      .from("store_memberships")
      .upsert(membershipPayload, { onConflict: "store_id,user_id", ignoreDuplicates: false });

    if (membershipError) {
      console.error("Failed to create membership during invite acceptance", membershipError);
      res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to add store membership." });
      return;
    }

    const staffPayload = {
      store_id: invite.store_id,
      user_id: ctx.user.id,
      first_name: profile.first_name.trim(),
      last_name: profile.last_name.trim(),
      email: (ctx.user.email ?? "").trim().toLowerCase(),
      phone: profile.phone?.trim() || null,
      address: profile.address ?? null,
      emergency_contact_name: profile.emergency_contact_name?.trim() || null,
      emergency_contact_relation: profile.emergency_contact_relation?.trim() || null,
      emergency_contact_phone: profile.emergency_contact_phone?.trim() || null,
      notes: profile.notes?.trim() || null,
      role: ROLE_LABELS[invite.role as StaffRole] ?? "Staff",
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
      res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to create staff profile." });
      return;
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
        res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to save compensation details." });
        return;
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
        res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to save schedule details." });
        return;
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
        res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to save schedule details." });
        return;
      }
    }

    const { error: updateInviteError } = await ctx.adminClient
      .from("staff_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: ctx.user.id })
      .eq("id", invite.id)
      .eq("status", "pending");

    if (updateInviteError) {
      console.error("Failed to mark invite accepted", updateInviteError);
      res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Unable to complete invite acceptance." });
      return;
    }

    res.status(200).json({ storeId: invite.store_id, staffId: staffRow.id });
  } catch (error) {
    console.error("staff accept-invite api error:", error);
    res.status(500).json({ error: "INVITE_ACCEPT_FAILED", message: "Internal server error." });
  }
});

staffInviteRouter.post("/send-invite-email", async (req: Request, res: Response) => {
  try {
    const { inviteId } = (req.body ?? {}) as { inviteId?: string };

    if (!inviteId) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Invite ID is required." });
      return;
    }

    const ctx = await getAuthedClients(req, res);
    if (!ctx) return;

    const storeId = req.headers["x-store-id"];
    const normalizedStoreId = Array.isArray(storeId) ? storeId[0] : storeId;
    if (!normalizedStoreId) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing store context." });
      return;
    }

    const { data: invite, error: fetchError } = await ctx.userClient
      .from("staff_invites")
      .select("id, email, role, store_id, status")
      .eq("id", inviteId)
      .eq("store_id", normalizedStoreId)
      .single();

    if (fetchError || !invite) {
      res.status(404).json({ error: "INVITE_NOT_FOUND", message: "Invite not found." });
      return;
    }

    if (invite.status !== "pending") {
      res.status(409).json({ error: "INVITE_NOT_PENDING", message: "Only pending invites can be emailed." });
      return;
    }

    const baseUrl = toSafeBaseUrl(req);
    const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(`/onboarding/staff?token=${invite.id}`)}`;

    const { error: emailError } = await ctx.adminClient.auth.admin.inviteUserByEmail(invite.email, {
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
      res.status(500).json({
        error: "INVITE_EMAIL_FAILED",
        message: emailError.message || "Failed to send invitation email.",
      });
      return;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("send-invite-email api error:", error);
    res.status(500).json({ error: "INVITE_EMAIL_FAILED", message: "Internal server error." });
  }
});

// DEPRECATED: The frontend now updates expiry via Supabase client and calls
// /send-invite-email instead. Kept for backward compatibility.
staffInviteRouter.post("/resend-invite", async (req: Request, res: Response) => {
  try {
    const { inviteId } = (req.body ?? {}) as { inviteId?: string };

    if (!inviteId) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Invite ID is required." });
      return;
    }

    const ctx = await getAuthedClients(req, res);
    if (!ctx) return;

    const storeId = req.headers["x-store-id"];
    const normalizedStoreId = Array.isArray(storeId) ? storeId[0] : storeId;
    if (!normalizedStoreId) {
      res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing store context." });
      return;
    }

    const { data: invite, error: fetchError } = await ctx.userClient
      .from("staff_invites")
      .select("*")
      .eq("id", inviteId)
      .eq("store_id", normalizedStoreId)
      .eq("status", "pending")
      .single();

    if (fetchError || !invite) {
      res.status(404).json({ error: "INVITE_NOT_FOUND", message: "Pending invite not found." });
      return;
    }

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await ctx.userClient
      .from("staff_invites")
      .update({ expires_at: newExpiresAt })
      .eq("id", inviteId)
      .eq("store_id", normalizedStoreId);

    if (updateError) {
      console.error("Failed to update invite expiry", updateError);
      res.status(500).json({ error: "RESEND_FAILED", message: "Failed to update invitation." });
      return;
    }

    const baseUrl = toSafeBaseUrl(req);
    const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(`/onboarding/staff?token=${invite.id}`)}`;

    const { error: emailError } = await ctx.adminClient.auth.admin.inviteUserByEmail(invite.email, {
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
      console.error("Failed to resend staff invite email", emailError);
      res.status(500).json({ error: "RESEND_EMAIL_FAILED", message: "Failed to resend invitation email." });
      return;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("staff resend-invite api error:", error);
    res.status(500).json({ error: "RESEND_FAILED", message: "Internal server error." });
  }
});
