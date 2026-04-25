// ── Role types & extraction ──────────────────────────────────────────────────

export type ActorRole = "front_desk" | "manager" | "owner" | "admin";

export interface Actor {
  userId?: string;
  role: ActorRole;
}

const VALID_ROLES: readonly string[] = ["front_desk", "manager", "owner", "admin"];

/**
 * Extract actor (role + optional userId) from the request.
 * Priority:
 *   1. Existing auth user role (req.user.role) if available
 *   2. actor.role from request body (temporary until auth exists)
 */
export function extractActor(req: { body?: { actor?: Actor }; user?: { role?: string; id?: string } }): Actor | null {
  // Prefer real auth if available
  if (req.user?.role && VALID_ROLES.includes(req.user.role)) {
    return { userId: req.user.id, role: req.user.role as ActorRole };
  }

  // Fall back to body-provided actor
  const actor = req.body?.actor;
  if (actor?.role && VALID_ROLES.includes(actor.role)) {
    return { userId: actor.userId, role: actor.role as ActorRole };
  }

  return null;
}

/** Numeric tier for comparison — higher = more privileges */
export function roleTier(role: ActorRole): number {
  const tiers: Record<ActorRole, number> = {
    front_desk: 0,
    manager: 1,
    owner: 2,
    admin: 2,
  };
  return tiers[role];
}
