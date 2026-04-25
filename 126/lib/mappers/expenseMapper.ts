import type { ExpenseRecord } from '@/lib/finance-types'
import type { Expense as DbExpense } from '@/hooks/data/useExpenses'

export function expenseFromDb(db: DbExpense): ExpenseRecord {
  // Derive status from date: future-dated expenses are 'Pending', past/today are 'Paid'
  const parsed = new Date(db.date)
  const status: ExpenseRecord['status'] =
    !isNaN(parsed.getTime()) && parsed.getTime() > Date.now() ? 'Pending' : 'Paid'

  return {
    id: db.id,
    category: db.category,
    vendor: db.vendor ?? '',
    date: db.date,
    status,
    amount: db.amount,
    description: db.description ?? '',
  }
}

export function expenseToDb(
  ui: ExpenseRecord
): Omit<DbExpense, 'id' | 'store_id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> {
  return {
    date: ui.date,
    category: ui.category,
    amount: ui.amount,
    vendor: ui.vendor || undefined,
    description: ui.description || undefined,
  }
}

export function expensesFromDb(dbExpenses: DbExpense[]): ExpenseRecord[] {
  return dbExpenses.map(expenseFromDb)
}
