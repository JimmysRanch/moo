type StoreLoadError = Error | {
  message?: string
  details?: string
  hint?: string
}

function getStringDetail(error: StoreLoadError | null | undefined, key: 'details' | 'hint'): string | undefined {
  if (!error || !(key in error)) return undefined
  return typeof error[key] === 'string' ? error[key] : undefined
}

export function isTransientStoreLoadError(error: StoreLoadError | null | undefined): boolean {
  const details = [error?.message, getStringDetail(error, 'details'), getStringDetail(error, 'hint')]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()

  return (
    details.includes('failed to fetch') ||
    details.includes('networkerror') ||
    details.includes('network request failed') ||
    details.includes('load failed') ||
    details.includes('fetch failed')
  )
}
