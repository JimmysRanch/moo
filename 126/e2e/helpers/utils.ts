/**
 * Generates a unique suffix for test data to avoid collisions.
 */
export function uniqueId(): string {
  return `E2E_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Generates a unique name with the given prefix.
 */
export function uniqueName(prefix: string): string {
  return `${prefix} ${uniqueId()}`
}
