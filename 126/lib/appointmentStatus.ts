/**
 * Appointment Status – canonical definitions, transitions, labels, and colors.
 *
 * This is the single source of truth for all appointment-status logic.
 * Import from here; do not duplicate color maps or transition tables elsewhere.
 */

// ── Canonical status types ───────────────────────────────────────────────────

export const WORKFLOW_STEPS = ['checked_in', 'in_progress', 'ready', 'picked_up'] as const
export type WorkflowStep = typeof WORKFLOW_STEPS[number]

export const ALL_STATUSES = [
  'scheduled',
  'checked_in',
  'in_progress',
  'ready',
  'picked_up',
  'cancelled',
  'no_show',
] as const
export type AppointmentStatus = typeof ALL_STATUSES[number]

/** Statuses that represent an active / in-shop appointment */
export const ACTIVE_STATUSES: AppointmentStatus[] = ['checked_in', 'in_progress', 'ready']

/** Statuses that represent a completed service (dog has left / paid) */
export const COMPLETED_STATUSES: AppointmentStatus[] = ['picked_up']

/** Statuses that are terminal (cannot advance) */
export const TERMINAL_STATUSES: AppointmentStatus[] = ['picked_up', 'cancelled', 'no_show']

// ── Labels ───────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled:   'Scheduled',
  checked_in:  'Checked In',
  in_progress: 'In Progress',
  ready:       'Ready',
  picked_up:   'Picked Up',
  cancelled:   'Cancelled',
  no_show:     'No Show',
}

// ── Colors (Tailwind classes, dark-theme friendly) ───────────────────────────

export const STATUS_BADGE_CLASSES: Record<AppointmentStatus, string> = {
  scheduled:   'bg-slate-500/20 text-slate-300',
  checked_in:  'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-purple-500/20 text-purple-400',
  ready:       'bg-orange-500/20 text-orange-400',
  picked_up:   'bg-green-500/20 text-green-400',
  cancelled:   'bg-red-500/20 text-red-400',
  no_show:     'bg-rose-900/30 text-rose-400',
}

/** Color used in the stepper for the active / completed step dot */
export const STEP_COLORS: Record<WorkflowStep, string> = {
  checked_in:  'bg-blue-500',
  in_progress: 'bg-purple-500',
  ready:       'bg-orange-500',
  picked_up:   'bg-green-500',
}

export const LATE_BADGE_CLASSES = 'bg-amber-500/20 text-amber-400'

// ── Valid forward transitions ────────────────────────────────────────────────

const TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  scheduled:   ['checked_in', 'cancelled', 'no_show'],
  checked_in:  ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['ready', 'cancelled'],
  ready:       ['picked_up', 'cancelled'],
}

/**
 * Returns the list of statuses an appointment can legally transition to.
 * Terminal statuses return an empty array.
 */
export function getAllowedTransitions(current: AppointmentStatus): AppointmentStatus[] {
  return TRANSITIONS[current] ?? []
}

/** Returns true if transitioning from `current` to `next` is valid. */
export function isValidTransition(current: AppointmentStatus, next: AppointmentStatus): boolean {
  return getAllowedTransitions(current).includes(next)
}

/**
 * Returns the next sequential workflow step, or null if there is none.
 * This is used by the stepper to know what step clicking "advance" moves to.
 */
export function getNextWorkflowStep(current: AppointmentStatus): WorkflowStep | null {
  const idx = WORKFLOW_STEPS.indexOf(current as WorkflowStep)
  if (idx === -1 || idx >= WORKFLOW_STEPS.length - 1) return null
  return WORKFLOW_STEPS[idx + 1]
}

/**
 * Returns the index of a workflow step (0-based), or -1 if the status is
 * not part of the main workflow (e.g. scheduled, cancelled, no_show).
 */
export function workflowStepIndex(status: AppointmentStatus): number {
  return WORKFLOW_STEPS.indexOf(status as WorkflowStep)
}

// ── Notification helpers ─────────────────────────────────────────────────────

export type NotificationType = 'manual_heads_up' | 'ready_pickup'

/**
 * Given an appointment's notification state, determine whether an auto
 * ready-pickup notification should be sent when transitioning to "ready".
 *
 * Returns true only if:
 *   - auto-send is enabled in settings
 *   - AND the client has NOT already been manually notified
 */
export function shouldAutoSendReadyNotification(
  autoSendEnabled: boolean,
  clientAlreadyNotified: boolean
): boolean {
  return autoSendEnabled && !clientAlreadyNotified
}

// ── Timestamp helpers ────────────────────────────────────────────────────────

/**
 * Returns the timestamp key that should be set when advancing to a given
 * workflow step.
 */
export function timestampFieldForStep(
  step: WorkflowStep
): 'checked_in_at' | 'in_progress_at' | 'ready_at' | 'picked_up_at' {
  const map = {
    checked_in:  'checked_in_at',
    in_progress: 'in_progress_at',
    ready:       'ready_at',
    picked_up:   'picked_up_at',
  } as const
  return map[step]
}

/**
 * Calculates "time in shop" duration in a human-readable compact format.
 * Returns null if the appointment has not been checked in.
 *
 * @param checkedInAt  ISO timestamp of check-in
 * @param pickedUpAt   ISO timestamp of pickup (null if still in shop)
 */
export function formatTimeInShop(
  checkedInAt: string | null | undefined,
  pickedUpAt: string | null | undefined
): string | null {
  if (!checkedInAt) return null
  const start = new Date(checkedInAt).getTime()
  const end = pickedUpAt ? new Date(pickedUpAt).getTime() : Date.now()
  const totalMinutes = Math.floor((end - start) / 60_000)
  if (totalMinutes < 0) return null
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

/**
 * Formats a timestamp as a short time string (e.g. "11:08 AM").
 */
export function formatShortTime(isoTimestamp: string | null | undefined): string | null {
  if (!isoTimestamp) return null
  return new Date(isoTimestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
