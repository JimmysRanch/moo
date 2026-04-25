export type InviteSummary = {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  hire_date?: string | null
}

export function parseInvitePayload(payload: unknown): InviteSummary {
  const parsedInvite = (payload as { invite?: InviteSummary } | null | undefined)?.invite
    ?? (payload as InviteSummary | null | undefined)

  if (!parsedInvite?.id) {
    throw new Error('Malformed invite response')
  }

  return parsedInvite
}
