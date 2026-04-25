import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/contexts/StoreContext'
import { useAuth } from '@/contexts/AuthContext'
import { paymentClient } from '@/stripe/client'

export interface PaymentIntentMetadataItem {
  id?: string
  name?: string
  type?: string
  quantity?: number
  price?: number
  total?: number
}

export interface PaymentIntentMetadata {
  appointmentId?: string | null
  clientId?: string | null
  clientName?: string | null
  subtotal?: number
  discount?: number
  discountDescription?: string
  additionalFees?: number
  additionalFeesDescription?: string
  taxAmount?: number
  totalBeforeTip?: number
  total?: number
  tipAmount?: number
  tipPaymentMethod?: string | null
  paymentMethod?: string
  items?: PaymentIntentMetadataItem[]
}

export interface PaymentIntentRecord {
  id: string
  internal_transaction_id?: string | null
  stripe_payment_intent_id: string
  stripe_charge_id?: string | null
  status: string
  amount: number
  currency: string
  payment_method: string
  store_id: string
  appointment_id?: string | null
  metadata: PaymentIntentMetadata
  created_at: string
  updated_at: string
}

export interface RefundRecord {
  id: string
  stripe_refund_id: string
  stripe_payment_intent_id?: string | null
  amount: number
  reason?: string | null
  notes?: string | null
  actor_user_id?: string | null
  actor_role?: string | null
  status: string
  store_id: string
  created_at: string
  updated_at: string
}

const PAYMENT_INTENTS_QUERY_KEY = 'payment_intents'
const REFUNDS_QUERY_KEY = 'refunds'
const DISPUTES_QUERY_KEY = 'stripe_disputes'

export interface DisputeRecord {
  id: string
  amount: number
  currency: string
  status: string
  reason?: string | null
  created: number
  charge?: string | null
  payment_intent?: string | null
  customer_name?: string | null
  payment_method_last4?: string | null
  payment_method_brand?: string | null
  notes?: string | null
  stripe_dashboard_url?: string | null
  evidence_details?: {
    due_by?: number | null
    has_evidence?: boolean
    submission_count?: number
  } | null
}

function normalizePaymentIntentMetadata(metadata: unknown): PaymentIntentMetadata {
  return metadata && typeof metadata === 'object' ? (metadata as PaymentIntentMetadata) : {}
}

function mapPaymentIntentRow(row: Omit<PaymentIntentRecord, 'metadata'> & { metadata: unknown }): PaymentIntentRecord {
  return {
    ...row,
    metadata: normalizePaymentIntentMetadata(row.metadata),
  }
}

export function getPaymentIntentAppointmentId(payment: PaymentIntentRecord): string | undefined {
  return payment.appointment_id ?? payment.metadata.appointmentId ?? undefined
}

export function paymentIntentMatchesClient(
  payment: PaymentIntentRecord,
  clientId: string | undefined,
  clientAppointmentIds: ReadonlySet<string>,
): boolean {
  if (!clientId) return false

  if (payment.metadata.clientId === clientId) {
    return true
  }

  const appointmentId = getPaymentIntentAppointmentId(payment)
  return appointmentId ? clientAppointmentIds.has(appointmentId) : false
}

export function usePaymentIntents() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [PAYMENT_INTENTS_QUERY_KEY, storeId],
    queryFn: async () => {
      if (!storeId) throw new Error('No active store')

      const { data, error } = await supabase
        .from('payment_intents')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []).map((row) => mapPaymentIntentRow(row as Omit<PaymentIntentRecord, 'metadata'> & { metadata: unknown }))
    },
    enabled: !!storeId && !!user,
  })
}

export function useRefunds(paymentIntentIds: string[]) {
  const { storeId } = useStore()
  const { user } = useAuth()
  const normalizedIds = Array.from(new Set(paymentIntentIds.filter(Boolean))).sort()

  return useQuery({
    queryKey: [REFUNDS_QUERY_KEY, storeId, normalizedIds],
    queryFn: async () => {
      if (!storeId || normalizedIds.length === 0) {
        return [] as RefundRecord[]
      }

      const { data, error } = await supabase
        .from('refunds')
        .select('*')
        .eq('store_id', storeId)
        .in('stripe_payment_intent_id', normalizedIds)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as RefundRecord[]
    },
    enabled: !!storeId && !!user,
  })
}

function mapDisputeRecord(record: unknown): DisputeRecord | null {
  if (!record || typeof record !== 'object') {
    return null
  }

  const dispute = record as Partial<DisputeRecord>
  if (!dispute.id || typeof dispute.id !== 'string') {
    return null
  }

  return {
    id: dispute.id,
    amount: typeof dispute.amount === 'number' ? dispute.amount : 0,
    currency: typeof dispute.currency === 'string' ? dispute.currency : 'usd',
    status: typeof dispute.status === 'string' ? dispute.status : 'warning_needs_response',
    reason: typeof dispute.reason === 'string' ? dispute.reason : null,
    created: typeof dispute.created === 'number' ? dispute.created : Math.floor(Date.now() / 1000),
    charge: typeof dispute.charge === 'string' ? dispute.charge : null,
    payment_intent: typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null,
    customer_name: typeof dispute.customer_name === 'string' ? dispute.customer_name : null,
    payment_method_last4: typeof dispute.payment_method_last4 === 'string' ? dispute.payment_method_last4 : null,
    payment_method_brand: typeof dispute.payment_method_brand === 'string' ? dispute.payment_method_brand : null,
    notes: typeof dispute.notes === 'string' ? dispute.notes : null,
    stripe_dashboard_url: typeof dispute.stripe_dashboard_url === 'string' ? dispute.stripe_dashboard_url : null,
    evidence_details: dispute.evidence_details ?? null,
  }
}

export function useDisputes() {
  const { storeId } = useStore()
  const { user } = useAuth()

  return useQuery({
    queryKey: [DISPUTES_QUERY_KEY, storeId],
    queryFn: async () => {
      const response = await paymentClient.listDisputes(50) as { disputes?: unknown[] }
      const disputes = response.disputes ?? []
      return disputes
        .map((record) => mapDisputeRecord(record))
        .filter((record): record is DisputeRecord => record !== null)
    },
    enabled: !!storeId && !!user,
  })
}

export interface SubmitDisputeEvidenceInput {
  disputeId: string
  notes: string
}

export function useSubmitDisputeEvidence() {
  const queryClient = useQueryClient()
  const { storeId } = useStore()

  return useMutation({
    mutationFn: async ({ disputeId, notes }: SubmitDisputeEvidenceInput) => {
      return paymentClient.submitDisputeEvidence(disputeId, notes)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [DISPUTES_QUERY_KEY, storeId] })
    },
  })
}

export interface CreateRefundInput {
  stripe_refund_id: string
  stripe_payment_intent_id?: string | null
  amount: number
  reason?: string | null
  notes?: string | null
  status: string
  store_id: string
  actor_user_id?: string | null
}

export function useCreateRefund() {
  const queryClient = useQueryClient()
  const { storeId } = useStore()

  return useMutation({
    mutationFn: async (input: CreateRefundInput) => {
      const { data, error } = await supabase
        .from('refunds')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as RefundRecord
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [REFUNDS_QUERY_KEY, storeId] })
    },
  })
}
