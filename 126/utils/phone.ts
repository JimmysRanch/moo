/**
 * Phone number utility functions for US phone numbers
 */

export function getPhoneDigits(phoneInput: string): string {
  return phoneInput.trim().replace(/\D/g, '')
}

/**
 * Format phone number to E.164 format
 * @param phoneInput - Raw phone number input (can include formatting characters)
 * @returns Formatted phone number in E.164 format (+1XXXXXXXXXX) or empty string if invalid
 */
export function formatPhoneNumber(phoneInput: string): string {
  const digitsOnly = getPhoneDigits(phoneInput)
  
  // Handle 11-digit numbers (already includes country code)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return '+' + digitsOnly
  }
  
  // Handle 10-digit numbers (add US country code)
  if (digitsOnly.length === 10) {
    return '+1' + digitsOnly
  }
  
  // Invalid format - return empty to trigger validation error
  return ''
}

/**
 * Validate phone number format
 * @param phoneInput - Raw phone number input (can include formatting characters)
 * @returns true if valid 10 or 11-digit US phone number, false otherwise
 */
export function validatePhoneNumber(phoneInput: string): boolean {
  const digitsOnly = getPhoneDigits(phoneInput)
  // Must be either 10 digits (US) or 11 digits starting with 1 (US/Canada with country code)
  return digitsOnly.length === 10 || (digitsOnly.length === 11 && digitsOnly.startsWith('1'))
}
