import type { Transaction as UITransaction, TransactionItem as UITransactionItem } from '@/lib/types'
import type {
  Transaction as DbTransaction,
  TransactionItem as DbTransactionItem,
} from '@/hooks/data/useTransactions'

const dbStatusToUi: Record<string, UITransaction['status']> = {
  pending: 'pending',
  completed: 'completed',
  refunded: 'refunded',
  cancelled: 'cancelled',
}

const uiStatusToDb: Record<string, DbTransaction['status']> = {
  pending: 'pending',
  completed: 'completed',
  refunded: 'refunded',
  cancelled: 'cancelled',
}

const dbTypeToUi: Record<string, UITransaction['type']> = {
  sale: 'sale',
  refund: 'refund',
  adjustment: 'adjustment',
}

const uiTypeToDb: Record<string, DbTransaction['type']> = {
  sale: 'sale',
  refund: 'refund',
  adjustment: 'adjustment',
}

function mapDbItems(dbItems: DbTransactionItem[]): UITransactionItem[] {
  return dbItems.map((item) => ({
    id: item.id,
    name: item.item_name,
    type: item.item_type === 'service' || item.item_type === 'addon' ? 'service' : 'product',
    quantity: item.quantity,
    price: item.price,
    total: item.total,
  }))
}

export function transactionFromDb(
  db: DbTransaction,
  dbItems?: DbTransactionItem[],
  clientName?: string
): UITransaction {
  return {
    id: db.id,
    appointmentId: db.appointment_id ?? undefined,
    date: db.date,
    clientId: db.client_id ?? '',
    clientName: clientName ?? '',
    items: dbItems ? mapDbItems(dbItems) : [],
    subtotal: db.subtotal,
    discount: db.discount ?? 0,
    discountDescription: db.discount_description ?? undefined,
    additionalFees: db.additional_fees ?? 0,
    additionalFeesDescription: db.additional_fees_description ?? undefined,
    total: db.total,
    tipAmount: db.tip_amount ?? 0,
    tipPaymentMethod: db.tip_payment_method as UITransaction['tipPaymentMethod'],
    paymentMethod: db.payment_method,
    status: dbStatusToUi[db.status] ?? 'pending',
    type: dbTypeToUi[db.type] ?? 'sale',
    stripePaymentIntentId: db.stripe_payment_intent_id ?? undefined,
  }
}

export function transactionToDb(
  ui: UITransaction
): Omit<DbTransaction, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {
  return {
    appointment_id: ui.appointmentId ?? undefined,
    client_id: ui.clientId || undefined,
    date: ui.date,
    subtotal: ui.subtotal,
    discount: ui.discount || undefined,
    discount_description: ui.discountDescription ?? undefined,
    additional_fees: ui.additionalFees || undefined,
    additional_fees_description: ui.additionalFeesDescription ?? undefined,
    total: ui.total,
    tip_amount: ui.tipAmount || undefined,
    tip_payment_method: ui.tipPaymentMethod ?? undefined,
    payment_method: ui.paymentMethod,
    status: (uiStatusToDb[ui.status] ?? 'pending') as DbTransaction['status'],
    type: (uiTypeToDb[ui.type] ?? 'sale') as DbTransaction['type'],
    stripe_payment_intent_id: ui.stripePaymentIntentId ?? undefined,
  }
}
