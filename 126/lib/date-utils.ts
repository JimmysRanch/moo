/**
 * Date utilities for timezone-aware operations.
 */

import { format, parseISO } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

/**
 * Get the business timezone.
 * Accepts an explicit timezone string (from business settings); falls back to the
 * browser timezone only when no configured timezone is available.
 *
 * Components that have access to business settings should always pass
 * `businessSettings.timezone` so the configured timezone is used as the sole
 * source of truth rather than the browser locale.
 */
export function getBusinessTimezone(timezone?: string): string {
  return timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Get current date in business timezone as YYYY-MM-DD format
 * This prevents off-by-one date bugs when using UTC conversion
 */
export function getTodayInBusinessTimezone(timezone?: string): string {
  const tz = getBusinessTimezone(timezone)
  const now = new Date()
  const zonedDate = toZonedTime(now, tz)
  return format(zonedDate, 'yyyy-MM-dd')
}

/**
 * Get current date and time in business timezone as ISO string
 */
export function getNowInBusinessTimezone(timezone?: string): string {
  const tz = getBusinessTimezone(timezone)
  const now = new Date()
  const zonedDate = toZonedTime(now, tz)
  return zonedDate.toISOString()
}

/**
 * Convert a date string to business timezone for display
 */
export function toBusinessTimezone(dateString: string, timezone?: string): Date {
  const tz = getBusinessTimezone(timezone)
  const date = parseISO(dateString)
  return toZonedTime(date, tz)
}

/**
 * Convert a local date/time to business timezone for storage
 */
export function fromBusinessTimezone(date: Date, timezone?: string): string {
  const tz = getBusinessTimezone(timezone)
  const zonedDate = fromZonedTime(date, tz)
  return zonedDate.toISOString()
}

/**
 * Format a date string in business timezone
 */
export function formatInBusinessTimezone(dateString: string, formatString: string, timezone?: string): string {
  const tz = getBusinessTimezone(timezone)
  const date = parseISO(dateString)
  const zonedDate = toZonedTime(date, tz)
  return format(zonedDate, formatString)
}

/**
 * Format a date string from yyyy-mm-dd to mm-dd-yyyy display format
 * This is the standard display format for the application
 */
export function formatDateForDisplay(dateString: string, timezone?: string): string {
  if (!dateString) return ''
  const tz = getBusinessTimezone(timezone)
  const date = parseISO(dateString)
  const zonedDate = toZonedTime(date, tz)
  return format(zonedDate, 'MM-dd-yyyy')
}

/**
 * Convert a JavaScript Date object to YYYY-MM-DD string in business timezone.
 * Pass the configured business timezone to avoid browser-local drift.
 * Use this instead of date.toISOString().split('T')[0] to avoid timezone bugs.
 */
export function dateToBusinessDateString(date: Date, timezone?: string): string {
  const tz = getBusinessTimezone(timezone)
  const zonedDate = toZonedTime(date, tz)
  return format(zonedDate, 'yyyy-MM-dd')
}

/**
 * Get the current Date object adjusted to represent "today" in business timezone.
 *
 * Returns a Date object whose **local** date properties (getDate, getMonth,
 * getFullYear) equal the current calendar date in the configured business timezone,
 * regardless of the browser's locale. Use this as the initial "current date" for
 * calendar/list views so that navigation (addDays, startOfWeek, etc.) and local-date
 * comparisons (format, isSameDay) are all anchored to the correct business date.
 */
export function getTodayDateInBusinessTimezone(timezone?: string): Date {
  // Get the YYYY-MM-DD string for today in the business timezone, then parse it as
  // local midnight so local date properties reflect the business calendar date.
  return parseISO(getTodayInBusinessTimezone(timezone))
}

/**
 * Check if two dates are the same day in business timezone.
 * Pass the configured business timezone to avoid browser-local drift.
 */
export function isSameDayInBusinessTimezone(date1: Date, date2: Date, timezone?: string): boolean {
  const tz = getBusinessTimezone(timezone)
  const zonedDate1 = toZonedTime(date1, tz)
  const zonedDate2 = toZonedTime(date2, tz)
  return format(zonedDate1, 'yyyy-MM-dd') === format(zonedDate2, 'yyyy-MM-dd')
}

/**
 * Compute date-range boundaries as YYYY-MM-DD strings anchored to the business
 * timezone.
 *
 * Because appointment dates are stored as timezone-agnostic YYYY-MM-DD strings,
 * comparing ranges as strings avoids any browser-local Date drift entirely.
 *
 * The `date` parameter must be a "calendar date pointer" — a Date whose **local**
 * date properties (getDate, getMonth, getFullYear) represent the intended business
 * calendar date. Such a Date is produced by getTodayDateInBusinessTimezone() or by
 * applying date-fns navigation helpers (addDays, addWeeks, addMonths, …) to one.
 */
export function getBusinessDateRangeStrings(
  date: Date,
  viewMode: 'day' | 'week' | 'month',
): { start: string; end: string } {
  // format() uses local date properties, which already represent the business date
  // for calendar-date-pointer Date objects.
  const dateStr = format(date, 'yyyy-MM-dd')
  if (viewMode === 'day') return { start: dateStr, end: dateStr }

  // Parse the YYYY-MM-DD parts (month is 1-indexed here).
  // Date constructor takes a 0-indexed month, hence `month - 1` throughout.
  const [year, month, day] = dateStr.split('-').map(Number)
  // Use local Date arithmetic on the parsed YYYY-MM-DD — safe because we are only
  // doing calendar arithmetic (not wall-clock conversion).
  const ref = new Date(year, month - 1, day)

  if (viewMode === 'week') {
    const dow = ref.getDay() // 0 = Sunday
    const start = new Date(year, month - 1, day - dow)
    const end = new Date(year, month - 1, day + (6 - dow))
    return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') }
  }

  // month
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0) // last day of month
  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') }
}

/**
 * Check whether an appointment's YYYY-MM-DD date string falls within a date range.
 * Uses pure string comparison — no Date objects involved.
 */
export function isAppointmentInBusinessDateRange(
  appointmentDate: string,
  start: string,
  end: string,
): boolean {
  return appointmentDate >= start && appointmentDate <= end
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date, not UTC.
 * 
 * CRITICAL: Do NOT use `new Date('2026-02-06')` as it parses as UTC midnight,
 * which becomes the PREVIOUS DAY in US timezones!
 * 
 * Example of the bug:
 *   new Date('2026-02-06') in EST = Feb 5, 2026 at 7 PM (wrong!)
 * 
 * This function correctly parses as local midnight:
 *   parseDateStringAsLocal('2026-02-06') in EST = Feb 6, 2026 at 12 AM (correct!)
 */
export function parseDateStringAsLocal(dateString: string): Date {
  if (!dateString) return new Date()
  // parseISO treats YYYY-MM-DD as local time, not UTC
  return parseISO(dateString)
}

/**
 * Format a date string (YYYY-MM-DD) for display without timezone conversion issues.
 * 
 * CRITICAL: Do NOT use `format(new Date(dateString), 'MMM d, yyyy')` as it will
 * show the WRONG date in US timezones due to UTC parsing!
 * 
 * @param dateString - Date in YYYY-MM-DD format
 * @param formatStr - date-fns format string (default: 'MMM d, yyyy')
 */
export function formatDateString(dateString: string, formatStr: string = 'MMM d, yyyy'): string {
  if (!dateString) return ''
  // parseISO treats YYYY-MM-DD as local time, avoiding the UTC conversion bug
  const date = parseISO(dateString)
  return format(date, formatStr)
}
