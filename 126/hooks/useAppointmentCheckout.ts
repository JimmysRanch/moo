/**
 * Unified hook for appointment checkout data.
 *
 * POS.tsx writes checkout totals/discounts/fees to the `payment_intents` table
 * (in the `metadata` column). The `transactions` table is a legacy source also
 * written by the POS flow. This hook combines both sources so every component
 * can read the correct final price without caring which path was used for checkout.
 *
 * Priority: payment_intents > transactions > appointment.totalPrice fallback
 */

import { useMemo } from 'react'
import { usePaymentIntents, getPaymentIntentAppointmentId } from './data/usePayments'
import { useTransactions } from './data/useTransactions'

export interface AppointmentCheckoutData {
  /** Final total paid including tip */
  total: number
  /** Total excluding tip — use this for commission/revenue calculations */
  totalBeforeTip: number
  /** Pre-discount sum of all cart items */
  subtotal: number
  /** Discount amount applied at checkout */
  discount: number
  discountDescription?: string
  /** Additional fees added at checkout */
  additionalFees: number
  additionalFeesDescription?: string
  /** Sales tax collected at checkout */
  taxAmount: number
  /** Tip amount */
  tipAmount: number
  tipPaymentMethod?: 'cash' | 'card'
  /** Payment method label */
  paymentMethod: string
}

/**
 * Returns a Map<appointmentId, AppointmentCheckoutData> combining both
 * payment_intents (priority) and legacy transactions (fallback).
 */
export function useAppointmentCheckoutMap(): Map<string, AppointmentCheckoutData> {
  const { data: paymentIntents } = usePaymentIntents()
  const { data: dbTransactions } = useTransactions()

  return useMemo(() => {
    const map = new Map<string, AppointmentCheckoutData>()

    // Add from transactions first (lower priority — legacy POS flow)
    for (const db of dbTransactions ?? []) {
      if (!db.appointment_id) continue
      const tipAmount = db.tip_amount ?? 0
      const total = db.total
      const additionalFees = db.additional_fees ?? 0
      const discount = db.discount ?? 0
      const taxAmount = Math.max(0, total - db.subtotal + discount - additionalFees - tipAmount)
      map.set(db.appointment_id, {
        total,
        totalBeforeTip: total - tipAmount,
        subtotal: db.subtotal,
        discount,
        discountDescription: db.discount_description ?? undefined,
        additionalFees,
        additionalFeesDescription: db.additional_fees_description ?? undefined,
        taxAmount,
        tipAmount,
        tipPaymentMethod:
          db.tip_payment_method === 'cash' || db.tip_payment_method === 'card'
            ? db.tip_payment_method
            : undefined,
        paymentMethod: db.payment_method,
      })
    }

    // Override with payment_intents (higher priority — POS checkout flow)
    for (const pi of paymentIntents ?? []) {
      const aptId = getPaymentIntentAppointmentId(pi)
      if (!aptId) continue
      const meta = pi.metadata
      const tipAmount = meta.tipAmount ?? 0
      const total = meta.total ?? pi.amount / 100
      const totalBeforeTip = meta.totalBeforeTip ?? total - tipAmount
      const subtotal = meta.subtotal ?? totalBeforeTip
      const additionalFees = meta.additionalFees ?? 0
      const discount = meta.discount ?? 0
      const taxAmount = meta.taxAmount ?? Math.max(0, totalBeforeTip - subtotal + discount - additionalFees)
      map.set(aptId, {
        total,
        totalBeforeTip,
        subtotal,
        discount,
        discountDescription: meta.discountDescription ?? undefined,
        additionalFees,
        additionalFeesDescription: meta.additionalFeesDescription ?? undefined,
        taxAmount,
        tipAmount,
        tipPaymentMethod:
          meta.tipPaymentMethod === 'cash' || meta.tipPaymentMethod === 'card'
            ? meta.tipPaymentMethod
            : undefined,
        paymentMethod: meta.paymentMethod ?? pi.payment_method,
      })
    }

    return map
  }, [paymentIntents, dbTransactions])
}
