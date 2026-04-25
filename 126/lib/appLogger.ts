/**
 * Internal app logging utility.
 *
 * Writes structured log entries to the `app_logs` Supabase table so the app
 * owner can review errors and degraded-mode events from within Settings > Logs.
 *
 * Design notes:
 *  - All writes are fire-and-forget; failures are silently swallowed so the
 *    logger NEVER breaks the app.
 *  - Context (route, user, store) is kept in module-level state and updated
 *    via `setLoggerContext`, which should be called from AppLayout on every
 *    navigation / auth change (mirroring the existing Sentry context pattern).
 *  - Sensitive data (tokens, passwords, full error stack dumps) must NOT be
 *    passed to these functions.
 */

import { supabase } from './supabase'

// ── Context ───────────────────────────────────────────────────────────────────

interface LoggerContext {
  route?: string
  userId?: string | null
  userName?: string | null
  storeId?: string | null
  storeName?: string | null
}

let currentContext: LoggerContext = {}

/**
 * Update the ambient context attached to every subsequent log entry.
 * Call this from AppLayout whenever route / user / store changes.
 */
export function setLoggerContext(ctx: LoggerContext) {
  currentContext = { ...currentContext, ...ctx }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogLevel = 'error' | 'warning' | 'info'

export interface LogEventOptions {
  /** Human-readable message shown prominently in the Logs UI. */
  message: string
  /** Short machine-readable event classification, e.g. "query_failure". */
  event_type: string
  /** Raw error / extra context (stringified). Not shown to end users. */
  details?: string
  /** Additional structured metadata (avoid sensitive values). */
  metadata?: Record<string, unknown>
  /** Override the ambient route. */
  route?: string
  /** Override the ambient store id. */
  storeId?: string | null
  /** Override the ambient store name. */
  storeName?: string | null
  /** Override the ambient user id. */
  userId?: string | null
  /** Override the ambient user name. */
  userName?: string | null
}

/** Options for {@link logFallback}. `event_type` is optional and defaults to `'fallback'`. */
export type LogFallbackOptions = Omit<LogEventOptions, 'event_type'> & {
  event_type?: string
}

// ── Internal write ────────────────────────────────────────────────────────────

function writeLog(level: LogLevel, opts: LogEventOptions): void {
  const {
    message,
    event_type,
    details,
    metadata,
    route = currentContext.route,
    storeId = currentContext.storeId,
    storeName = currentContext.storeName,
    userId = currentContext.userId,
    userName = currentContext.userName,
  } = opts

  // Fire-and-forget — never await, never throw
  Promise.resolve().then(async () => {
    try {
      await supabase.from('app_logs').insert({
        level,
        event_type,
        message,
        details: details ?? null,
        route: route ?? null,
        store_id: storeId ?? null,
        store_name: storeName ?? null,
        user_id: userId ?? null,
        user_name: userName ?? null,
        metadata: metadata ?? null,
      })
    } catch {
      // Silently ignore — logging must never break the app
    }
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Log an unexpected application error.
 * Call from global error boundaries, query/mutation error handlers, etc.
 */
export function logError(opts: LogEventOptions): void {
  writeLog('error', opts)
}

/**
 * Log a meaningful warning (app recovered, but not ideally).
 */
export function logWarning(opts: LogEventOptions): void {
  writeLog('warning', opts)
}

/**
 * Log a fallback / degraded-mode event where the app used a backup path
 * instead of the preferred one.
 * The event_type defaults to 'fallback' when not specified by the caller.
 */
export function logFallback(opts: LogFallbackOptions): void {
  writeLog('warning', { ...opts, event_type: opts.event_type ?? 'fallback' })
}

/**
 * General-purpose log at any level.
 */
export function logAppEvent(level: LogLevel, opts: LogEventOptions): void {
  writeLog(level, opts)
}
