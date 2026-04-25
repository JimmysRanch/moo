import type { PaymentIntentRecord, RefundRecord, DisputeRecord } from '@/hooks/data/usePayments'
import type { Transaction, TransactionItem } from '@/hooks/data/useTransactions'
import { transactionFromDb } from '@/lib/mappers/transactionMapper'

export type LedgerEventType = 'payment' | 'refund' | 'dispute' | 'failed_payment'
export type LedgerSourceType = 'local' | 'stripe'
export type LedgerFilter = 'all' | 'payments' | 'refunds' | 'disputes' | 'cash' | 'card'

export interface PaymentLedgerEntry {
  id: string
  eventType: LedgerEventType
  sourceType: LedgerSourceType
  status: string
  createdAt: string
  clientName: string
  serviceLabel?: string
  petNames?: string[]
  paymentMethodLabel?: string
  grossAmount: number
  tipAmount: number
  feeAmount: number
  netAmount: number
  currency: string
  stripePaymentIntentId?: string
  stripeChargeId?: string
  stripeRefundId?: string
  stripeDisputeId?: string
  refundReason?: string
  disputeReason?: string
  disputeReasonLabel?: string
  disputeStatus?: string
  responseDueAt?: string
  disputeHasEvidence?: boolean
  disputeEvidenceSubmissionCount?: number
  customerName?: string
  paymentMethodLast4?: string
  paymentMethodBrand?: string
  stripeDashboardUrl?: string
  notes?: string
  linkedPaymentReference?: string
}

export function humanizeDisputeReason(reason: string | undefined): string {
  if (!reason) return 'Unknown'
  return reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeDate(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  if (value.length === 10) return `${value}T00:00:00Z`
  return value
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function humanizePaymentMethod(method: string | undefined): string {
  const value = method?.trim().toLowerCase()
  if (!value) return 'Unknown'
  if (UUID_PATTERN.test(value)) return 'Card'
  if (value.includes('cash')) return 'Cash'
  if (value === 'check') return 'Check'
  if (value === 'other') return 'Other'
  if (value.includes('card')) return 'Card'
  if (value.includes('credit')) return 'Card'
  if (value.includes('debit')) return 'Card'
  if (value.includes('tap')) return 'Tap to Pay'
  // Title-case unknown values for consistent UI display
  return (method ?? 'Unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function splitServiceAndPets(service: string | undefined): { serviceLabel?: string; petNames: string[] } {
  if (!service) return { serviceLabel: undefined, petNames: [] }

  const parts = service.split(' - ')
  const serviceLabel = parts[0]?.trim() || undefined
  const petNames = (parts[1] ?? '')
    .split(' & ')
    .map((pet) => pet.trim())
    .filter(Boolean)

  return { serviceLabel, petNames }
}

export function buildPaymentsLedger(params: {
  transactions: Transaction[]
  transactionItems: TransactionItem[]
  paymentIntents: PaymentIntentRecord[]
  refunds: RefundRecord[]
  disputes: DisputeRecord[]
}): PaymentLedgerEntry[] {
  const { transactions, transactionItems, paymentIntents, refunds, disputes } = params

  const paymentIntentById = new Map(paymentIntents.map((paymentIntent) => [paymentIntent.stripe_payment_intent_id, paymentIntent]))
  const itemsByTransactionId = transactionItems.reduce<Record<string, TransactionItem[]>>((acc, item) => {
    acc[item.transaction_id] = [...(acc[item.transaction_id] ?? []), item]
    return acc
  }, {})

  const paymentByIntentId = new Map<string, PaymentLedgerEntry>()

  const localPayments = transactions.map((db) => {
    const ui = transactionFromDb(db, itemsByTransactionId[db.id])
    const noteService = db.notes?.split(' — ')[0]?.trim() ?? ''
    const service = ui.items.map((item) => item.name).join(', ') || noteService
    const { serviceLabel, petNames } = splitServiceAndPets(service)
    const linkedIntent = db.stripe_payment_intent_id ? paymentIntentById.get(db.stripe_payment_intent_id) : undefined
    const linkedPaymentMethod = linkedIntent?.metadata.paymentMethod ?? linkedIntent?.payment_method
    const linkedChargeId = linkedIntent?.stripe_charge_id ?? undefined
    const linkedCurrency = linkedIntent?.currency ?? 'usd'
    const linkedStatus = linkedIntent?.status
    const total = Math.max(ui.total, 0)
    const tipAmount = Math.max(ui.tipAmount, 0)
    const feeAmount = 0

    const status = linkedStatus ?? (db.status === 'completed' ? 'succeeded' : db.status)
    const eventType: LedgerEventType = status === 'succeeded' ? 'payment' : 'failed_payment'

    const row: PaymentLedgerEntry = {
      id: `local-${ui.id}`,
      eventType,
      sourceType: 'local',
      status,
      createdAt: normalizeDate(db.created_at, `${ui.date}T00:00:00Z`),
      clientName: ui.clientName || 'Walk-in',
      serviceLabel,
      petNames,
      paymentMethodLabel: humanizePaymentMethod(linkedPaymentMethod ?? ui.paymentMethod),
      grossAmount: total,
      tipAmount,
      feeAmount,
      netAmount: Math.max(total - feeAmount, 0),
      currency: linkedCurrency,
      stripePaymentIntentId: db.stripe_payment_intent_id ?? undefined,
      stripeChargeId: linkedChargeId,
      notes: db.notes ?? undefined,
    }

    if (db.stripe_payment_intent_id) {
      paymentByIntentId.set(db.stripe_payment_intent_id, row)
    }

    return row
  })

  const representedIntentIds = new Set(
    localPayments
      .map((payment) => payment.stripePaymentIntentId)
      .filter((value): value is string => Boolean(value)),
  )

  const stripePayments = paymentIntents
    .filter((paymentIntent) => !representedIntentIds.has(paymentIntent.stripe_payment_intent_id))
    .map((paymentIntent) => {
    const paymentMethod = paymentIntent.metadata.paymentMethod ?? paymentIntent.payment_method
    const tipAmount = Math.max(paymentIntent.metadata.tipAmount ?? 0, 0)
    const total = Math.max(paymentIntent.metadata.total ?? paymentIntent.amount / 100, 0)
    const service = paymentIntent.metadata.items
      ?.map((item) => item.name?.trim())
      .filter(Boolean)
      .join(', ') ?? ''
    const { serviceLabel, petNames } = splitServiceAndPets(service)
    const stripeDashboardUrl = paymentIntent.stripe_charge_id
      ? `https://dashboard.stripe.com/payments/${paymentIntent.stripe_charge_id}`
      : undefined

    const status = paymentIntent.status
    const eventType: LedgerEventType = status === 'succeeded' ? 'payment' : 'failed_payment'

    const row: PaymentLedgerEntry = {
      id: `stripe-${paymentIntent.stripe_payment_intent_id}`,
      eventType,
      sourceType: 'stripe',
      status,
      createdAt: paymentIntent.created_at,
      clientName: paymentIntent.metadata.clientName?.trim() || 'Walk-in',
      serviceLabel,
      petNames,
      paymentMethodLabel: humanizePaymentMethod(paymentMethod),
      grossAmount: total,
      tipAmount,
      feeAmount: 0,
      netAmount: total,
      currency: paymentIntent.currency || 'usd',
      stripePaymentIntentId: paymentIntent.stripe_payment_intent_id,
      stripeChargeId: paymentIntent.stripe_charge_id ?? undefined,
      stripeDashboardUrl,
    }

      paymentByIntentId.set(paymentIntent.stripe_payment_intent_id, row)
      return row
    })

  const refundRows = refunds.map((refund) => {
    const amount = Math.max(refund.amount / 100, 0)
    const linkedPayment = refund.stripe_payment_intent_id ? paymentByIntentId.get(refund.stripe_payment_intent_id) : undefined

    return {
      id: `refund-${refund.stripe_refund_id}`,
      eventType: 'refund',
      sourceType: 'stripe',
      status: refund.status,
      createdAt: refund.created_at,
      clientName: linkedPayment?.clientName ?? 'Unknown client',
      serviceLabel: linkedPayment?.serviceLabel,
      petNames: linkedPayment?.petNames,
      paymentMethodLabel: linkedPayment?.paymentMethodLabel ?? 'Card',
      grossAmount: amount,
      tipAmount: 0,
      feeAmount: 0,
      netAmount: -amount,
      currency: linkedPayment?.currency ?? 'usd',
      stripePaymentIntentId: refund.stripe_payment_intent_id ?? undefined,
      stripeRefundId: refund.stripe_refund_id,
      refundReason: refund.reason ?? undefined,
      notes: refund.notes ?? undefined,
      linkedPaymentReference: refund.stripe_payment_intent_id ?? undefined,
    } satisfies PaymentLedgerEntry
  })

  const disputeRows = disputes.map((dispute) => {
    const amount = Math.max(dispute.amount / 100, 0)
    const linkedPayment = dispute.payment_intent ? paymentByIntentId.get(dispute.payment_intent) : undefined

    return {
      id: `dispute-${dispute.id}`,
      eventType: 'dispute',
      sourceType: 'stripe',
      status: dispute.status,
      createdAt: new Date(dispute.created * 1000).toISOString(),
      clientName: linkedPayment?.clientName ?? 'Unknown client',
      serviceLabel: linkedPayment?.serviceLabel,
      petNames: linkedPayment?.petNames,
      paymentMethodLabel: linkedPayment?.paymentMethodLabel ?? 'Card',
      grossAmount: amount,
      tipAmount: 0,
      feeAmount: 0,
      netAmount: -amount,
      currency: dispute.currency || linkedPayment?.currency || 'usd',
      stripePaymentIntentId: dispute.payment_intent ?? linkedPayment?.stripePaymentIntentId,
      stripeChargeId: dispute.charge ?? linkedPayment?.stripeChargeId,
      stripeDisputeId: dispute.id,
      disputeReason: dispute.reason ?? undefined,
      disputeReasonLabel: humanizeDisputeReason(dispute.reason ?? undefined),
      disputeStatus: dispute.status,
      responseDueAt: dispute.evidence_details?.due_by
        ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
        : undefined,
      disputeHasEvidence: Boolean(dispute.evidence_details?.has_evidence),
      disputeEvidenceSubmissionCount: dispute.evidence_details?.submission_count ?? 0,
      customerName: dispute.customer_name ?? linkedPayment?.clientName,
      paymentMethodLast4: dispute.payment_method_last4 ?? undefined,
      paymentMethodBrand: dispute.payment_method_brand ?? undefined,
      stripeDashboardUrl: dispute.stripe_dashboard_url ?? linkedPayment?.stripeDashboardUrl,
      notes: dispute.notes ?? undefined,
      linkedPaymentReference: dispute.payment_intent ?? dispute.charge ?? undefined,
    } satisfies PaymentLedgerEntry
  })

  return [...localPayments, ...stripePayments, ...refundRows, ...disputeRows].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
}

export function filterPaymentsLedger(entries: PaymentLedgerEntry[], filter: LedgerFilter): PaymentLedgerEntry[] {
  if (filter === 'all') return entries
  if (filter === 'payments') return entries.filter((entry) => entry.eventType === 'payment' || entry.eventType === 'failed_payment')
  if (filter === 'refunds') return entries.filter((entry) => entry.eventType === 'refund')
  if (filter === 'disputes') return entries.filter((entry) => entry.eventType === 'dispute')
  if (filter === 'cash') return entries.filter((entry) => isCashMethod(entry.paymentMethodLabel))
  return entries.filter((entry) => isCardMethod(entry.paymentMethodLabel))
}

function isCashMethod(label: string | undefined): boolean {
  const v = label?.toLowerCase() ?? ''
  return v === 'cash' || v === 'check' || v === 'other'
}

function isCardMethod(label: string | undefined): boolean {
  const v = label?.toLowerCase() ?? ''
  return v === 'card' || v === 'tap to pay'
}

export function summarizePaymentsLedger(entries: PaymentLedgerEntry[]) {
  return entries.reduce(
    (acc, entry) => {
      if (entry.eventType === 'payment') {
        acc.totalCollected += entry.grossAmount
        if (isCashMethod(entry.paymentMethodLabel)) {
          acc.cashCollected += entry.grossAmount
        } else {
          acc.cardCollected += entry.grossAmount
        }
      }

      if (entry.eventType === 'refund') {
        acc.refunded += entry.grossAmount
      }

      if (entry.eventType === 'dispute') {
        if (!['won', 'lost', 'closed'].includes(entry.status.toLowerCase())) {
          acc.openDisputes += 1
        }
      }

      return acc
    },
    {
      totalCollected: 0,
      cashCollected: 0,
      cardCollected: 0,
      refunded: 0,
      openDisputes: 0,
    },
  )
}
