const KEY = 'activeStoreId'

export function getActiveStoreId(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setActiveStoreId(id: string): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // ignore
  }
}

export function clearActiveStoreId(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
