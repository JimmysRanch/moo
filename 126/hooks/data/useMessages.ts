import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { buildConversationFlags, computeMessageStats, type MessageFlagRecord } from '@/lib/messages'

export type MessageDeliveryStatus = 'draft' | 'queued' | 'sent' | 'delivered' | 'failed' | 'received'
export type MessageDirection = 'inbound' | 'outbound' | 'system'
export type MessageType = 'sms' | 'system' | 'template_generated'

export interface MessageConversation {
  id: string
  store_id: string
  client_id: string
  appointment_id?: string | null
  assigned_staff_id?: string | null
  channel: 'sms'
  status: 'active' | 'archived'
  unread_count: number
  last_message_preview?: string | null
  last_message_at?: string | null
  last_message_direction?: MessageDirection | null
  last_message_status?: MessageDeliveryStatus | null
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface MessageRecord {
  id: string
  store_id: string
  conversation_id: string
  client_id: string
  appointment_id?: string | null
  staff_id?: string | null
  direction: MessageDirection
  message_type: MessageType
  body: string
  media: Array<{ url: string; mimeType?: string; name?: string }>
  delivery_status: MessageDeliveryStatus
  error_message?: string | null
  is_read: boolean
  is_automated: boolean
  template_id?: string | null
  provider_message_id?: string | null
  metadata?: Record<string, unknown>
  sent_at?: string | null
  delivered_at?: string | null
  created_at: string
  updated_at: string
}

export interface MessageTemplate {
  id: string
  store_id: string
  name: string
  category: string
  body: string
  is_enabled: boolean
  is_system: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface MessageAutomation {
  id: string
  store_id: string
  automation_key: string
  is_enabled: boolean
  send_offset_minutes: number
  template_id?: string | null
  config?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface MessageUsageCycle {
  id: string
  store_id: string
  cycle_start: string
  cycle_end: string
  included_credits: number
  used_credits: number
  overage_credits: number
  created_at: string
  updated_at: string
}


export interface MessageProviderProfile {
  id: string
  store_id: string
  provider: 'twilio'
  account_sid?: string | null
  messaging_service_sid?: string | null
  messaging_service_name?: string | null
  provisioning_status: 'not_started' | 'provisioning' | 'action_needed' | 'in_review' | 'active' | 'failed'
  compliance_status: 'not_started' | 'provisioning' | 'action_needed' | 'in_review' | 'active' | 'failed'
  sender_status: 'not_started' | 'provisioning' | 'action_needed' | 'in_review' | 'active' | 'failed'
  onboarding_data?: Record<string, unknown>
  provider_metadata?: Record<string, unknown>
  last_error?: string | null
  last_synced_at?: string | null
}

export interface MessageSenderInventory {
  id: string
  store_id: string
  provider_profile_id: string
  phone_number_sid: string
  phone_number: string
  sender_type: 'twilio_number'
  status: 'active' | 'inactive' | 'failed'
  capabilities?: Record<string, unknown>
  country_code?: string | null
  is_primary: boolean
}

export interface MessageProviderStatus {
  provider: MessageProviderProfile | null
  sender: MessageSenderInventory | null
  readinessStatus: 'not_started' | 'provisioning' | 'action_needed' | 'in_review' | 'active' | 'failed'
  canSend: boolean
}

export interface MessageProviderSetupInput {
  businessName: string
  contactName: string
  email: string
  website?: string
  areaCode?: string
  optInWorkflow: string
  addressStreet: string
  addressCity: string
  addressState: string
  addressPostalCode: string
  addressCountry: string
}

const CONVERSATIONS_KEY = 'message_conversations'
const MESSAGES_KEY = 'messages'
const TEMPLATES_KEY = 'message_templates'
const AUTOMATIONS_KEY = 'message_automations'
const USAGE_KEY = 'message_usage_cycles'


async function invokeTwilioMessages<T>(storeId: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('twilio-messages', {
    body: payload,
    headers: { 'x-store-id': storeId },
  })
  if (error) throw error
  if (!data) throw new Error('No response from twilio-messages edge function')
  return data
}

export function useMessageConversations() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [CONVERSATIONS_KEY, storeId],
    enabled: !!storeId && !!user,
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      const { data, error } = await supabase
        .from('message_conversations')
        .select('*')
        .eq('store_id', storeId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as MessageConversation[]
    },
  })
}

export function useConversationMessages(conversationId?: string) {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [MESSAGES_KEY, storeId, conversationId],
    enabled: !!storeId && !!user && !!conversationId,
    queryFn: async () => {
      if (!storeId || !conversationId) throw new Error('Missing conversation context')
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('store_id', storeId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as MessageRecord[]
    },
  })
}

export function useMessageTemplates() {
  const { storeId } = useStore()
  const { user } = useAuth()
  return useQuery({
    queryKey: [TEMPLATES_KEY, storeId],
    enabled: !!storeId && !!user,
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('store_id', storeId)
        .order('display_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as MessageTemplate[]
    },
  })
}

export function useUpsertMessageTemplate() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (template: Partial<MessageTemplate> & Pick<MessageTemplate, 'name' | 'category' | 'body'>) => {
      if (!storeId) throw new Error('No active store')
      if (template.id) {
        const { data, error } = await supabase
          .from('message_templates')
          .update({
            name: template.name,
            category: template.category,
            body: template.body,
            is_enabled: template.is_enabled,
            display_order: template.display_order,
          })
          .eq('id', template.id)
          .eq('store_id', storeId)
          .select()
          .single()
        if (error) throw error
        return data as MessageTemplate
      }
      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          store_id: storeId,
          name: template.name,
          category: template.category,
          body: template.body,
          is_enabled: template.is_enabled ?? true,
          is_system: false,
          display_order: template.display_order ?? 99,
        })
        .select()
        .single()
      if (error) throw error
      return data as MessageTemplate
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, storeId] }),
  })
}

export function useMessageAutomations() {
  const { storeId } = useStore()
  const { user } = useAuth()
  return useQuery({
    queryKey: [AUTOMATIONS_KEY, storeId],
    enabled: !!storeId && !!user,
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      const { data, error } = await supabase
        .from('message_automations')
        .select('*')
        .eq('store_id', storeId)
        .order('automation_key', { ascending: true })
      if (error) throw error
      return (data ?? []) as MessageAutomation[]
    },
  })
}

export function useUpsertMessageAutomation() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (automation: Partial<MessageAutomation> & Pick<MessageAutomation, 'automation_key'>) => {
      if (!storeId) throw new Error('No active store')
      const payload = {
        store_id: storeId,
        automation_key: automation.automation_key,
        is_enabled: automation.is_enabled ?? true,
        send_offset_minutes: automation.send_offset_minutes ?? 0,
        template_id: automation.template_id ?? null,
        config: automation.config ?? {},
      }
      const { data, error } = await supabase
        .from('message_automations')
        .upsert(payload, { onConflict: 'store_id,automation_key' })
        .select()
        .single()
      if (error) throw error
      return data as MessageAutomation
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_KEY, storeId] }),
  })
}

export function useMessageUsageCycle() {
  const { storeId } = useStore()
  const { user } = useAuth()
  return useQuery({
    queryKey: [USAGE_KEY, storeId],
    enabled: !!storeId && !!user,
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      const { data, error } = await supabase
        .from('message_usage_cycles')
        .select('*')
        .eq('store_id', storeId)
        .order('cycle_start', { ascending: false })
        .limit(1)
      if (error) throw error
      return (data?.[0] ?? null) as MessageUsageCycle | null
    },
  })
}


export function useConversationMessageFlags() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: ['message_conversation_flags', storeId],
    enabled: !!storeId && !!user,
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      const { data, error } = await supabase
        .from('messages')
        .select('conversation_id, is_automated, delivery_status')
        .eq('store_id', storeId)
      if (error) throw error
      return buildConversationFlags((data ?? []) as MessageFlagRecord[])
    },
  })
}

export function useSendMessage() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { clientId: string; conversationId?: string; appointmentId?: string; body: string; templateId?: string; automated?: boolean; notificationType?: 'manual_heads_up' | 'ready_pickup' }) => {
      if (!storeId) throw new Error('No active store')
      return invokeTwilioMessages<{ conversation: MessageConversation; message: MessageRecord }>(storeId, { action: 'send_message', ...payload })
    },
    onSuccess: async (data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY, storeId] }),
        queryClient.invalidateQueries({ queryKey: [MESSAGES_KEY, storeId, data.conversation.id] }),
        queryClient.invalidateQueries({ queryKey: [USAGE_KEY, storeId] }),
        queryClient.invalidateQueries({ queryKey: ['message_conversation_flags', storeId] }),
        queryClient.invalidateQueries({ queryKey: ['appointments', storeId] }),
        ...(variables.appointmentId ? [queryClient.invalidateQueries({ queryKey: ['appointments', storeId, variables.appointmentId] })] : []),
      ])
    },
  })
}

export function useMarkConversationRead() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!storeId) throw new Error('No active store')
      const { error } = await supabase
        .from('message_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId)
        .eq('store_id', storeId)
      if (error) throw error
      const { error: messagesError } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('store_id', storeId)
        .eq('is_read', false)
      if (messagesError) throw messagesError
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY, storeId] }),
  })
}

export function useMessageStats(conversations: MessageConversation[], flags: Map<string, { hasAutomated: boolean; hasFailed: boolean }>, activeStaffId?: string | null) {
  return computeMessageStats(conversations, flags, activeStaffId)
}


export function useMessageProviderStatus() {
  const { storeId } = useStore()
  const { user } = useAuth()
  return useQuery({
    queryKey: ['message_provider_status', storeId],
    enabled: !!storeId && !!user,
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')
      return invokeTwilioMessages<MessageProviderStatus>(storeId, { action: 'provider_status' })
    },
  })
}

export function useSetupMessageProvider() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: MessageProviderSetupInput) => {
      if (!storeId) throw new Error('No active store')
      return invokeTwilioMessages<MessageProviderStatus>(storeId, { action: 'provider_setup', ...payload })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['message_provider_status', storeId] }),
        queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY, storeId] }),
        queryClient.invalidateQueries({ queryKey: ['business_settings', storeId] }),
      ])
    },
  })
}

export function useRefreshMessageProvider() {
  const { storeId } = useStore()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error('No active store')
      return invokeTwilioMessages<MessageProviderStatus>(storeId, { action: 'provider_refresh' })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['message_provider_status', storeId] }),
        queryClient.invalidateQueries({ queryKey: ['business_settings', storeId] }),
      ])
    },
  })
}
