import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a groomer's full name as "First L." (first name + last initial).
 * Falls back to the original name if it cannot be parsed.
 */
export function formatGroomerName(fullName: string): string {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return fullName
  const firstName = parts[0]
  const lastPart = parts[parts.length - 1]
  if (!lastPart) return fullName
  const lastInitial = lastPart[0].toUpperCase()
  return `${firstName} ${lastInitial}.`
}
