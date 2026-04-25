/**
 * Custom error class for optimistic locking conflicts.
 * Thrown when an update targets a record that has been modified by another user
 * since it was last fetched (i.e., `updated_at` no longer matches).
 *
 * Callers should catch this error and prompt the user to reload latest data.
 */
export class ConcurrencyError extends Error {
  constructor(entity: string) {
    super(`This ${entity} was updated by another user. Please reload the latest data and try again.`)
    this.name = 'ConcurrencyError'
  }
}
