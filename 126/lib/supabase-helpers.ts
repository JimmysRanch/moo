import { getActiveStoreId } from './activeStore'

/**
 * Get the current store ID from context or throw error
 */
export function getStoreId(): string {
  const storeId = getActiveStoreId()
  if (!storeId) {
    throw new Error('No active store selected')
  }
  return storeId
}
