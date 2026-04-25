import {
  addMonths,
  addQuarters,
  addYears,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  isWithinInterval,
  lastDayOfMonth,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from 'date-fns'

import type { Transaction, TransactionItem } from '@/hooks/data/useTransactions'

export type SalesTaxFilingSchedule = 'monthly' | 'quarterly' | 'yearly'
export type SalesTaxPeriodStatus = 'unfiled' | 'filed' | 'paid'

export interface SalesTaxHistoryEntry {
  periodKey: string
  periodLabel?: string
  startDate?: string
  endDate?: string
  dueDate?: string
  totalSales?: number
  taxableSales?: number
  taxCollected?: number
  status: SalesTaxPeriodStatus
  filedAt?: string
  paidAt?: string
  confirmationNumber?: string
  notes?: string
}

export interface SalesTaxSettings {
  collectSalesTax: boolean
  rate: string
  applyToServices: boolean
  applyToRetailProducts: boolean
  nexusState: string
  filingSchedule: SalesTaxFilingSchedule
  filingDueDay: number
  filingHistory: SalesTaxHistoryEntry[]
}

export interface SalesTaxPeriodSummary {
  periodKey: string
  periodLabel: string
  startDate: string
  endDate: string
  dueDate: string
  totalSales: number
  taxableSales: number
  taxCollected: number
  status: SalesTaxPeriodStatus
  filedAt?: string
  paidAt?: string
  confirmationNumber?: string
  notes?: string
}

export interface SalesTaxDashboardSummary {
  today: number
  thisWeek: number
  thisMonth: number
  thisYear: number
  currentPeriodAmount: number
}

export interface SalesTaxCheckoutItem {
  item_type: TransactionItem['item_type']
  total: number
}

export const DEFAULT_SALES_TAX_SETTINGS: SalesTaxSettings = {
  collectSalesTax: false,
  rate: '0',
  applyToServices: true,
  applyToRetailProducts: false,
  nexusState: 'TX',
  filingSchedule: 'monthly',
  filingDueDay: 20,
  filingHistory: [],
}

export const SALES_TAX_DISCLAIMER = [
  "This tax tracking tool is provided for informational purposes only and should not be considered as professional tax advice.",
  "While we strive for accuracy, the calculations and deadlines provided may not reflect your specific state requirements, business situation, or recent changes in tax laws.",
  "You are responsible for verifying all tax obligations, filing requirements, and payment deadlines with your state's tax authority.",
  "We recommend consulting with a qualified tax professional or certified public accountant for guidance specific to your business.",
  "The developers and operators of this application accept no liability for any errors, omissions, penalties, interest, or other consequences resulting from the use of this tool.",
  "Always verify tax rates, filing schedules, and payment requirements with your state's Department of Revenue or equivalent agency.",
].join(' ')

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function toStringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function toOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function toOptionalNumber(value: unknown) {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value)
      : Number.NaN

  return Number.isFinite(numeric) ? numeric : undefined
}

function clampDueDay(value: unknown, fallback: number) {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN

  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(31, Math.trunc(numeric)))
}

function normalizeStatus(value: unknown): SalesTaxPeriodStatus {
  if (value === 'filed' || value === 'paid') return value
  return 'unfiled'
}

function normalizeHistory(value: unknown): SalesTaxHistoryEntry[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const periodKey = typeof record.periodKey === 'string' ? record.periodKey : ''
      if (!periodKey) return null

      const legacyPaid = toBoolean(record.paid, false)
      const legacyFiledDate = toOptionalString(record.filingDate)
      const status = record.status
        ? normalizeStatus(record.status)
        : legacyPaid
          ? 'paid'
          : legacyFiledDate
            ? 'filed'
            : 'unfiled'

      return {
        periodKey,
        periodLabel: toOptionalString(record.periodLabel),
        startDate: toOptionalString(record.startDate),
        endDate: toOptionalString(record.endDate),
        dueDate: toOptionalString(record.dueDate),
        totalSales: toOptionalNumber(record.totalSales),
        taxableSales: toOptionalNumber(record.taxableSales),
        taxCollected: toOptionalNumber(record.taxCollected ?? record.amount),
        status,
        filedAt: toOptionalString(record.filedAt ?? record.filingDate),
        paidAt: toOptionalString(record.paidAt),
        confirmationNumber: toOptionalString(record.confirmationNumber),
        notes: toOptionalString(record.notes),
      }
    })
    .filter((entry): entry is SalesTaxHistoryEntry => entry !== null)
}

export function normalizeSalesTaxSettings(value: unknown): SalesTaxSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const filingSchedule = record.filingSchedule

  return {
    collectSalesTax: toBoolean(record.collectSalesTax, DEFAULT_SALES_TAX_SETTINGS.collectSalesTax),
    rate: toStringValue(record.rate, DEFAULT_SALES_TAX_SETTINGS.rate),
    applyToServices: toBoolean(record.applyToServices, DEFAULT_SALES_TAX_SETTINGS.applyToServices),
    applyToRetailProducts: toBoolean(record.applyToRetailProducts, DEFAULT_SALES_TAX_SETTINGS.applyToRetailProducts),
    nexusState: toStringValue(record.nexusState, DEFAULT_SALES_TAX_SETTINGS.nexusState),
    filingSchedule: filingSchedule === 'quarterly' || filingSchedule === 'yearly' ? filingSchedule : DEFAULT_SALES_TAX_SETTINGS.filingSchedule,
    filingDueDay: clampDueDay(record.filingDueDay, DEFAULT_SALES_TAX_SETTINGS.filingDueDay),
    filingHistory: normalizeHistory(record.filingHistory),
  }
}

export function upsertSalesTaxHistoryEntry(
  settings: SalesTaxSettings,
  entry: SalesTaxHistoryEntry
) {
  const existingEntry = settings.filingHistory.find((historyEntry) => historyEntry.periodKey === entry.periodKey)
  const mergedEntry = {
    ...existingEntry,
    ...entry,
  }
  const today = format(new Date(), 'yyyy-MM-dd')
  const filedAt = toOptionalString(mergedEntry.filedAt)
  const paidAt = toOptionalString(mergedEntry.paidAt)

  const nextEntry: SalesTaxHistoryEntry = {
    ...mergedEntry,
    taxCollected: mergedEntry.taxCollected ?? existingEntry?.taxCollected,
    confirmationNumber: toOptionalString(mergedEntry.confirmationNumber),
    notes: toOptionalString(mergedEntry.notes),
  }

  if (mergedEntry.status === 'unfiled') {
    nextEntry.filedAt = undefined
    nextEntry.paidAt = undefined
  } else if (mergedEntry.status === 'filed') {
    nextEntry.filedAt = filedAt ?? today
    nextEntry.paidAt = undefined
  } else {
    nextEntry.paidAt = paidAt ?? today
    nextEntry.filedAt = filedAt ?? nextEntry.paidAt
  }

  return {
    ...settings,
    filingHistory: [
      ...settings.filingHistory.filter((historyEntry) => historyEntry.periodKey !== entry.periodKey),
      nextEntry,
    ],
  }
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function getRateDecimal(settings: SalesTaxSettings) {
  const rate = Number.parseFloat(settings.rate)
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return rate / 100
}

function isTaxableItem(item: Pick<TransactionItem, 'item_type'>, settings: SalesTaxSettings) {
  if ((item.item_type === 'service' || item.item_type === 'addon') && settings.applyToServices) return true
  if (item.item_type === 'product' && settings.applyToRetailProducts) return true
  return false
}

export function calculateTaxableSubtotal(
  transaction: Pick<Transaction, 'subtotal'>,
  items: TransactionItem[] | undefined,
  settings: SalesTaxSettings
) {
  if (!settings.collectSalesTax) return 0
  if (!settings.applyToServices && !settings.applyToRetailProducts) return 0

  if (!items || items.length === 0) {
    if (settings.applyToServices) {
      return Math.max(transaction.subtotal, 0)
    }
    return 0
  }

  return roundCurrency(items.reduce((sum, item) => (
    isTaxableItem(item, settings) ? sum + item.total : sum
  ), 0))
}

export function calculateSalesTaxForTransaction(
  transaction: Pick<Transaction, 'subtotal'>,
  items: TransactionItem[] | undefined,
  settings: SalesTaxSettings
) {
  return roundCurrency(calculateTaxableSubtotal(transaction, items, settings) * getRateDecimal(settings))
}

export function calculateTaxableSubtotalForItems(
  items: SalesTaxCheckoutItem[],
  settings: SalesTaxSettings
) {
  if (!settings.collectSalesTax) return 0
  if (!settings.applyToServices && !settings.applyToRetailProducts) return 0

  return roundCurrency(items.reduce((sum, item) => (
    isTaxableItem(item, settings) ? sum + item.total : sum
  ), 0))
}

export function calculateSalesTaxForItems(
  items: SalesTaxCheckoutItem[],
  settings: SalesTaxSettings,
  discount = 0
) {
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.total, 0))
  const taxableSubtotal = calculateTaxableSubtotalForItems(items, settings)
  if (subtotal <= 0 || taxableSubtotal <= 0) return 0

  const normalizedDiscount = Math.max(0, Math.min(discount, subtotal))
  const taxableDiscountShare = normalizedDiscount * (taxableSubtotal / subtotal)
  const taxableBase = Math.max(0, taxableSubtotal - taxableDiscountShare)

  return roundCurrency(taxableBase * getRateDecimal(settings))
}

function getPeriodDescriptor(schedule: SalesTaxFilingSchedule, anchorDate: Date, dueDay: number) {
  const anchor = startOfDay(anchorDate)
  let start: Date
  let end: Date
  let dueMonthBase: Date
  let periodKey: string
  let periodLabel: string

  if (schedule === 'quarterly') {
    start = startOfQuarter(anchor)
    end = endOfQuarter(anchor)
    dueMonthBase = addMonths(start, 3)
    periodKey = `quarterly:${format(start, 'yyyy')}-Q${Math.floor(start.getMonth() / 3) + 1}`
    periodLabel = `Q${Math.floor(start.getMonth() / 3) + 1} ${format(start, 'yyyy')}`
  } else if (schedule === 'yearly') {
    start = startOfYear(anchor)
    end = endOfYear(anchor)
    dueMonthBase = addYears(start, 1)
    periodKey = `yearly:${format(start, 'yyyy')}`
    periodLabel = format(start, 'yyyy')
  } else {
    start = startOfMonth(anchor)
    end = endOfMonth(anchor)
    dueMonthBase = addMonths(start, 1)
    periodKey = `monthly:${format(start, 'yyyy-MM')}`
    periodLabel = format(start, 'MMMM yyyy')
  }

  const dueMonthLastDay = lastDayOfMonth(dueMonthBase).getDate()
  const dueDate = new Date(
    dueMonthBase.getFullYear(),
    dueMonthBase.getMonth(),
    Math.min(Math.max(dueDay, 1), dueMonthLastDay)
  )

  return {
    periodKey,
    periodLabel,
    start,
    end,
    dueDate,
  }
}

export function shiftPeriodAnchor(schedule: SalesTaxFilingSchedule, anchorDate: Date, offset: number) {
  if (schedule === 'quarterly') return addQuarters(anchorDate, offset)
  if (schedule === 'yearly') return addYears(anchorDate, offset)
  return addMonths(anchorDate, offset)
}

function getSalesTaxDateBoundary(date: string) {
  return startOfDay(new Date(`${date}T00:00:00`))
}

export function isSalesTaxPeriodOverdue(
  period: Pick<SalesTaxHistoryEntry, 'status' | 'dueDate'> | Pick<SalesTaxPeriodSummary, 'status' | 'dueDate'>,
  now = new Date()
) {
  if (period.status === 'paid' || !period.dueDate) return false
  return now.getTime() > endOfDay(getSalesTaxDateBoundary(period.dueDate)).getTime()
}

export function getUpcomingSalesTaxFiling(settings: SalesTaxSettings, now = new Date()) {
  const candidates = [-1, 0, 1]
    .map((offset) => getPeriodDescriptor(settings.filingSchedule, shiftPeriodAnchor(settings.filingSchedule, now, offset), settings.filingDueDay))
    .filter((period) => period.dueDate >= startOfDay(now))
    .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime())

  return candidates[0] ?? getPeriodDescriptor(settings.filingSchedule, now, settings.filingDueDay)
}

export function calculateSalesTaxDashboardSummary(
  transactions: Transaction[],
  itemsByTransactionId: Record<string, TransactionItem[]>,
  settings: SalesTaxSettings,
  now = new Date()
): SalesTaxDashboardSummary {
  if (!settings.collectSalesTax) {
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      thisYear: 0,
      currentPeriodAmount: 0,
    }
  }

  const today = startOfDay(now)
  const weekStart = startOfWeek(today)
  const currentPeriod = getPeriodDescriptor(settings.filingSchedule, now, settings.filingDueDay)

  let todayTotal = 0
  let weekTotal = 0
  let monthTotal = 0
  let yearTotal = 0
  let currentPeriodTotal = 0

  for (const transaction of transactions) {
    if (transaction.status !== 'completed' || transaction.type !== 'sale') continue

    const transactionDate = startOfDay(new Date(`${transaction.date}T00:00:00`))
    const taxAmount = calculateSalesTaxForTransaction(transaction, itemsByTransactionId[transaction.id], settings)
    if (taxAmount <= 0) continue

    if (isSameDay(transactionDate, today)) todayTotal += taxAmount
    if (transactionDate >= weekStart && transactionDate <= today) weekTotal += taxAmount
    if (isSameMonth(transactionDate, today)) monthTotal += taxAmount
    if (isSameYear(transactionDate, today)) yearTotal += taxAmount
    if (isWithinInterval(transactionDate, { start: currentPeriod.start, end: currentPeriod.end })) {
      currentPeriodTotal += taxAmount
    }
  }

  return {
    today: roundCurrency(todayTotal),
    thisWeek: roundCurrency(weekTotal),
    thisMonth: roundCurrency(monthTotal),
    thisYear: roundCurrency(yearTotal),
    currentPeriodAmount: roundCurrency(currentPeriodTotal),
  }
}

export function buildSalesTaxPeriodSummaries(
  transactions: Transaction[],
  itemsByTransactionId: Record<string, TransactionItem[]>,
  settings: SalesTaxSettings,
  now = new Date(),
  count = 6
): SalesTaxPeriodSummary[] {
  const periods = Array.from({ length: count }, (_, index) => {
    const anchorDate = shiftPeriodAnchor(settings.filingSchedule, now, -index)
    return getPeriodDescriptor(settings.filingSchedule, anchorDate, settings.filingDueDay)
  })

  const historyByPeriod = new Map(settings.filingHistory.map((entry) => [entry.periodKey, entry]))

  return periods.map((period) => {
    let totalSales = 0
    let taxableSales = 0
    let taxCollected = 0

    for (const transaction of transactions) {
      if (transaction.status !== 'completed' || transaction.type !== 'sale') continue

      const transactionDate = startOfDay(new Date(`${transaction.date}T00:00:00`))
      if (!isWithinInterval(transactionDate, { start: period.start, end: period.end })) continue

      totalSales += Math.max(transaction.subtotal, 0)
      taxableSales += calculateTaxableSubtotal(transaction, itemsByTransactionId[transaction.id], settings)
      taxCollected += calculateSalesTaxForTransaction(transaction, itemsByTransactionId[transaction.id], settings)
    }

    const historyEntry = historyByPeriod.get(period.periodKey)
    const storedTaxCollected = historyEntry && historyEntry.status !== 'unfiled'
      ? historyEntry.taxCollected
      : undefined

    return {
      periodKey: period.periodKey,
      periodLabel: period.periodLabel,
      startDate: format(period.start, 'yyyy-MM-dd'),
      endDate: format(period.end, 'yyyy-MM-dd'),
      dueDate: format(period.dueDate, 'yyyy-MM-dd'),
      totalSales: roundCurrency(totalSales),
      taxableSales: roundCurrency(taxableSales),
      taxCollected: roundCurrency(storedTaxCollected ?? taxCollected),
      status: historyEntry?.status ?? 'unfiled',
      filedAt: historyEntry?.filedAt,
      paidAt: historyEntry?.paidAt,
      confirmationNumber: historyEntry?.confirmationNumber,
      notes: historyEntry?.notes,
    }
  })
}

export function calculateOutstandingSalesTax(periods: SalesTaxPeriodSummary[], now = new Date()) {
  return roundCurrency(
    periods.reduce((sum, period) => {
      if (!isSalesTaxPeriodOverdue(period, now)) return sum
      return sum + period.taxCollected
    }, 0)
  )
}
