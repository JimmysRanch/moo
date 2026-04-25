export type MessagesFilter = 'All' | 'Unread' | 'Assigned to Me' | 'Automated' | 'Failed' | 'Archived'

export interface ConversationFilterable {
  id: string
  unread_count: number
  assigned_staff_id?: string | null
  status: 'active' | 'archived'
}

export interface ConversationMessageFlags {
  hasAutomated: boolean
  hasFailed: boolean
}

export interface MessageFlagRecord {
  conversation_id: string
  is_automated: boolean
  delivery_status: string
}

export function buildConversationFlags(messages: MessageFlagRecord[]) {
  const flags = new Map<string, ConversationMessageFlags>()
  messages.forEach((message) => {
    const current = flags.get(message.conversation_id) ?? { hasAutomated: false, hasFailed: false }
    flags.set(message.conversation_id, {
      hasAutomated: current.hasAutomated || message.is_automated,
      hasFailed: current.hasFailed || message.delivery_status === 'failed',
    })
  })
  return flags
}

export function computeMessageStats(conversations: ConversationFilterable[], flags: Map<string, ConversationMessageFlags>, currentStaffId?: string | null) {
  return {
    unread: conversations.filter((conversation) => conversation.unread_count > 0).length,
    assignedToMe: conversations.filter((conversation) => currentStaffId && conversation.assigned_staff_id === currentStaffId).length,
    automated: conversations.filter((conversation) => flags.get(conversation.id)?.hasAutomated).length,
    failed: conversations.filter((conversation) => flags.get(conversation.id)?.hasFailed).length,
    archived: conversations.filter((conversation) => conversation.status === 'archived').length,
  }
}

export function matchesMessagesFilter(filter: MessagesFilter, conversation: ConversationFilterable, flags: Map<string, ConversationMessageFlags>, currentStaffId?: string | null) {
  switch (filter) {
    case 'Unread':
      return conversation.unread_count > 0
    case 'Assigned to Me':
      return Boolean(currentStaffId) && conversation.assigned_staff_id === currentStaffId
    case 'Automated':
      return flags.get(conversation.id)?.hasAutomated === true
    case 'Failed':
      return flags.get(conversation.id)?.hasFailed === true
    case 'Archived':
      return conversation.status === 'archived'
    default:
      return true
  }
}

export function resolveTemplateCategoryForSave(currentCategory?: string | null) {
  return currentCategory?.trim() || 'custom'
}
