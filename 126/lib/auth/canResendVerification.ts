/**
 * Determines whether the given error message indicates a resend-eligible
 * auth callback failure (missing code, expired link, or invalid link).
 */
export function canResendVerification(errorMsg: string): boolean {
  const lower = (errorMsg ?? '').toLowerCase()

  const isMissingCode = lower.includes('missing authentication code')
  const isExpiredCallbackRelated =
    lower.includes('expired') &&
    (lower.includes('link') ||
      lower.includes('callback') ||
      lower.includes('token') ||
      lower.includes('code'))
  const isInvalidCallbackRelated =
    lower.includes('invalid') &&
    (lower.includes('link') ||
      lower.includes('callback') ||
      lower.includes('token') ||
      lower.includes('code'))

  return isMissingCode || isExpiredCallbackRelated || isInvalidCallbackRelated
}
