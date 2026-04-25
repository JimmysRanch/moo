export type NormalizedDeliveryStatus = 'draft' | 'queued' | 'sent' | 'delivered' | 'failed' | 'received'
export type ProviderReadinessStatus = 'not_started' | 'provisioning' | 'action_needed' | 'in_review' | 'active' | 'failed'

export function normalizeProviderDeliveryStatus(status: string): NormalizedDeliveryStatus | null {
  const normalized = status.trim().toLowerCase()
  if (!normalized) return null
  if (['queued', 'accepted', 'scheduled', 'sending', 'submitted'].includes(normalized)) return 'queued'
  if (['sent'].includes(normalized)) return 'sent'
  if (['delivered'].includes(normalized)) return 'delivered'
  if (['failed', 'undelivered', 'canceled', 'cancelled', 'rejected'].includes(normalized)) return 'failed'
  if (['received', 'inbound', 'receiving'].includes(normalized)) return 'received'
  if (['draft'].includes(normalized)) return 'draft'
  return null
}

export function normalizePhoneDigits(phoneInput: string | null | undefined): string {
  return (phoneInput ?? '').trim().replace(/\D/g, '')
}

export function formatPhoneNumberE164(phoneInput: string | null | undefined): string | null {
  const digitsOnly = normalizePhoneDigits(phoneInput)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) return `+${digitsOnly}`
  if (digitsOnly.length === 10) return `+1${digitsOnly}`
  return null
}

export function sanitizePhoneForLookup(phoneInput: string | null | undefined) {
  const digits = normalizePhoneDigits(phoneInput)
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

export function resolveSendTargets(input: {
  requestedClientId: string
  conversation?: { client_id: string; appointment_id?: string | null } | null
  requestedAppointmentId?: string | null
}) {
  const resolvedClientId = input.conversation?.client_id ?? input.requestedClientId
  if (input.conversation && input.conversation.client_id !== input.requestedClientId) {
    throw new Error('CONVERSATION_CLIENT_MISMATCH')
  }
  return {
    clientId: resolvedClientId,
    appointmentId: input.requestedAppointmentId ?? input.conversation?.appointment_id ?? null,
  }
}

export function buildTwilioWebhookUrl(baseUrl: string, pathname: string) {
  return `${baseUrl.replace(/\/$/, '')}${pathname}`
}

export function getProviderReadinessStatus(profile: {
  provisioning_status?: string | null
  compliance_status?: string | null
  messaging_service_sid?: string | null
  sender_status?: string | null
  phone_number?: string | null
}) {
  if (!profile.messaging_service_sid || !profile.phone_number) return 'not_started' satisfies ProviderReadinessStatus
  if (profile.provisioning_status === 'failed' || profile.sender_status === 'failed') return 'failed' satisfies ProviderReadinessStatus
  if (profile.provisioning_status === 'action_needed' || profile.compliance_status === 'action_needed') return 'action_needed' satisfies ProviderReadinessStatus
  if (profile.provisioning_status === 'in_review' || profile.compliance_status === 'in_review') return 'in_review' satisfies ProviderReadinessStatus
  if (profile.provisioning_status === 'provisioning') return 'provisioning' satisfies ProviderReadinessStatus
  return 'active' satisfies ProviderReadinessStatus
}
