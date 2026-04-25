import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useQuery } from '@tanstack/react-query'
import { SquaresFour, Circle, CreditCard, Users, Receipt, TrendUp, PawPrint, CaretRight, Gavel, Wallet, WarningCircle, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { FinancialChart } from '@/components/FinancialChart'
import { useIsMobile } from '@/hooks/use-mobile'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { PayrollOverview } from '@/components/PayrollOverview'
import { useTransactionItemsForTransactions, useTransactions, type TransactionItem } from "@/hooks/data/useTransactions"
import { useDisputes, usePaymentIntents, useRefunds, useSubmitDisputeEvidence } from "@/hooks/data/usePayments"
import { useExpenses } from "@/hooks/data/useExpenses"
import { expensesFromDb } from "@/lib/mappers/expenseMapper"
import { formatDateForDisplay, getTodayInBusinessTimezone } from "@/lib/date-utils"
import { paymentClient, type StripePayout } from '@/stripe/client'
import {
  buildPaymentsLedger,
  filterPaymentsLedger,
  summarizePaymentsLedger,
  type LedgerFilter,
  type PaymentLedgerEntry,
  humanizeDisputeReason,
} from '@/lib/financeLedger'
import { useStore } from '@/contexts/StoreContext'
import {
  buildSalesTaxPeriodSummaries,
  calculateSalesTaxDashboardSummary,
  DEFAULT_SALES_TAX_SETTINGS,
  isSalesTaxPeriodOverdue,
  SALES_TAX_DISCLAIMER,
  normalizeSalesTaxSettings,
  shiftPeriodAnchor,
  upsertSalesTaxHistoryEntry,
  type SalesTaxPeriodStatus,
  type SalesTaxSettings,
} from '@/lib/salesTax'

const FINANCES_TABS = [
  'dashboard',
  'expenses',
  'payments',
  'payouts',
  'payroll',
  'taxes',
  'disputes',
] as const

type FinancesTabKey = (typeof FINANCES_TABS)[number]

function normalizeFinancesTab(tab: string | null): FinancesTabKey {
  if (!tab) return 'dashboard'
  if (tab === 'stripe') return 'payouts'
  if ((FINANCES_TABS as readonly string[]).includes(tab)) {
    return tab as FinancesTabKey
  }
  return 'dashboard'
}

function formatCurrency(cents: number | null | undefined, currency = 'usd') {
  if (typeof cents !== 'number') return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function formatUnixDate(timestamp?: number | null) {
  if (!timestamp) return '—'
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function Finances() {
  type TaxActionKey = 'filed' | 'paid' | 'unfiled' | 'save'

  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = normalizeFinancesTab(searchParams.get('tab'))
  const isMobile = useIsMobile()
  const [selectedPayment, setSelectedPayment] = useState<PaymentLedgerEntry | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentsLedgerFilter, setPaymentsLedgerFilter] = useState<LedgerFilter>('all')
  const [selectedDispute, setSelectedDispute] = useState<PaymentLedgerEntry | null>(null)
  const [disputeDetailsOpen, setDisputeDetailsOpen] = useState(false)
  const [disputeSort, setDisputeSort] = useState<{ key: 'respondBy' | 'disputedOn' | 'status' | 'reason' | 'from' | 'amount'; direction: 'asc' | 'desc' }>({ key: 'disputedOn', direction: 'desc' })
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [taxSettings, setTaxSettings] = useState<SalesTaxSettings>(DEFAULT_SALES_TAX_SETTINGS)
  const [selectedTaxPeriodOffset, setSelectedTaxPeriodOffset] = useState(0)
  const [taxHistoryFilter, setTaxHistoryFilter] = useState<'all' | 'unpaid' | 'paid' | 'overdue'>('all')
  const [taxActionDialogOpen, setTaxActionDialogOpen] = useState(false)
  const [pendingTaxAction, setPendingTaxAction] = useState<TaxActionKey | null>(null)
  const [taxEditor, setTaxEditor] = useState({
    filedAt: '',
    paidAt: '',
    confirmationNumber: '',
    notes: '',
  })
  const { role } = useStore()
  const canRespondToDisputes = role === 'manager' || role === 'owner' || role === 'admin'
  const submitDisputeEvidence = useSubmitDisputeEvidence()
  const { data: dbTransactions } = useTransactions()
  const { data: paymentIntents } = usePaymentIntents()
  const paymentIntentIds = useMemo(
    () => (paymentIntents ?? []).map((payment) => payment.stripe_payment_intent_id),
    [paymentIntents],
  )
  const { data: refunds } = useRefunds(paymentIntentIds)
  const { data: disputes } = useDisputes()
  const { data: dbExpenses } = useExpenses()
  const transactionIds = useMemo(() => (dbTransactions || []).map((transaction) => transaction.id), [dbTransactions])
  const { data: dbTransactionItems } = useTransactionItemsForTransactions(transactionIds)
  const { data: savedTaxSettings } = useQuery({
    queryKey: ['pos-tax-settings'],
    queryFn: async () => {
      const res = await paymentClient.getPosSettings()
      return normalizeSalesTaxSettings(res.settings?.sales_tax)
    },
  })
  const [payoutRows, setPayoutRows] = useState<StripePayout[]>([])
  const [payoutCursor, setPayoutCursor] = useState<string | null>(null)
  const [payoutHasMore, setPayoutHasMore] = useState(false)
  const [selectedPayout, setSelectedPayout] = useState<StripePayout | null>(null)
  const [payoutLoadingMore, setPayoutLoadingMore] = useState(false)
  const {
    data: payoutData,
    isLoading: payoutLoading,
    isError: payoutError,
    refetch: refetchPayouts,
    isRefetching: payoutRefetching,
  } = useQuery({
    queryKey: ['stripe-payouts'],
    queryFn: () => paymentClient.listPayouts(20),
    enabled: activeTab === 'payouts',
    staleTime: 60_000,
    retry: 1,
  })

  const handleLoadMorePayouts = useCallback(async () => {
    if (!payoutHasMore || !payoutCursor || payoutLoadingMore) return
    setPayoutLoadingMore(true)
    try {
      const response = await paymentClient.listPayouts(20, payoutCursor)
      setPayoutRows((current) => [...current, ...(response.payouts ?? [])])
      setPayoutCursor(response.next_cursor)
      setPayoutHasMore(response.has_more)
    } catch (error) {
      console.error('Failed to load more payouts', error)
      toast.error('Failed to load more payouts. Please try again later.')
      setPayoutHasMore(false)
    } finally {
      setPayoutLoadingMore(false)
    }
  }, [payoutCursor, payoutHasMore, payoutLoadingMore])

  const getStatusBadgeVariant = (status: SalesTaxPeriodStatus, overdue: boolean) => {
    if (overdue) return 'destructive' as const
    if (status === 'paid') return 'default' as const
    return 'secondary' as const
  }

  const itemsByTransactionId = useMemo(() => {
    return (dbTransactionItems || []).reduce<Record<string, TransactionItem[]>>((acc, item) => {
      acc[item.transaction_id] = [...(acc[item.transaction_id] || []), item]
      return acc
    }, {})
  }, [dbTransactionItems])
  const paymentsLedger = useMemo(
    () =>
      buildPaymentsLedger({
        transactions: dbTransactions ?? [],
        transactionItems: dbTransactionItems ?? [],
        paymentIntents: paymentIntents ?? [],
        refunds: refunds ?? [],
        disputes: disputes ?? [],
      }),
    [dbTransactionItems, dbTransactions, disputes, paymentIntents, refunds],
  )
  const filteredPaymentsLedger = useMemo(
    () => filterPaymentsLedger(paymentsLedger, paymentsLedgerFilter),
    [paymentsLedger, paymentsLedgerFilter],
  )
  const disputeLedgerRows = useMemo(
    () =>
      paymentsLedger
        .filter((entry) => entry.eventType === 'dispute')
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [paymentsLedger],
  )
  const isDisputeOpen = useCallback((entry: PaymentLedgerEntry) => !['won', 'lost', 'closed'].includes((entry.disputeStatus || entry.status).toLowerCase()), [])
  const isDisputeActionNeeded = useCallback((entry: PaymentLedgerEntry) => {
    const status = (entry.disputeStatus || entry.status).toLowerCase()
    return isDisputeOpen(entry) && (status.includes('needs_response') || status.includes('warning'))
  }, [isDisputeOpen])
  const dueDateUrgency = (entry: PaymentLedgerEntry): 'none' | 'warning' | 'destructive' => {
    if (!entry.responseDueAt) return 'none'
    const now = Date.now()
    const due = new Date(entry.responseDueAt).getTime()
    if (Number.isNaN(due)) return 'none'
    if (due < now) return 'destructive'
    const hoursUntil = (due - now) / (1000 * 60 * 60)
    if (hoursUntil <= 72) return 'warning'
    return 'none'
  }
  const filteredDisputes = useMemo(() => {
    const rows = [...disputeLedgerRows]

    rows.sort((a, b) => {
      const actionNeededA = isDisputeActionNeeded(a) ? 1 : 0
      const actionNeededB = isDisputeActionNeeded(b) ? 1 : 0
      if (actionNeededA !== actionNeededB) return actionNeededB - actionNeededA

      const dir = disputeSort.direction === 'asc' ? 1 : -1
      if (disputeSort.key === 'amount') return (a.grossAmount - b.grossAmount) * dir
      if (disputeSort.key === 'disputedOn') return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
      if (disputeSort.key === 'respondBy') return ((new Date(a.responseDueAt ?? 0).getTime()) - (new Date(b.responseDueAt ?? 0).getTime())) * dir
      if (disputeSort.key === 'status') return (a.disputeStatus || a.status).localeCompare(b.disputeStatus || b.status) * dir
      if (disputeSort.key === 'reason') return (a.disputeReasonLabel || a.disputeReason || '').localeCompare(b.disputeReasonLabel || b.disputeReason || '') * dir
      return a.clientName.localeCompare(b.clientName) * dir
    })

    return rows
  }, [disputeLedgerRows, disputeSort.direction, disputeSort.key, isDisputeActionNeeded])
  const disputeSummary = useMemo(() => {
    return disputeLedgerRows.reduce((acc, entry) => {
      if (isDisputeOpen(entry)) acc.open += 1
      if (isDisputeActionNeeded(entry)) acc.actionNeeded += 1
      if ((entry.disputeStatus || entry.status).toLowerCase() === 'won') acc.won += 1
      if ((entry.disputeStatus || entry.status).toLowerCase() === 'lost') acc.lost += 1
      acc.totalAmount += entry.grossAmount
      return acc
    }, { open: 0, actionNeeded: 0, won: 0, lost: 0, totalAmount: 0 })
  }, [disputeLedgerRows, isDisputeActionNeeded, isDisputeOpen])
  const paymentsLedgerSummary = useMemo(() => summarizePaymentsLedger(paymentsLedger), [paymentsLedger])

  const expenses = useMemo(() => dbExpenses ? expensesFromDb(dbExpenses) : [], [dbExpenses])

  const salesTaxSummary = useMemo(
    () => calculateSalesTaxDashboardSummary(dbTransactions || [], itemsByTransactionId, taxSettings),
    [dbTransactions, itemsByTransactionId, taxSettings]
  )
  const selectedTaxPeriodDate = useMemo(
    () => shiftPeriodAnchor(taxSettings.filingSchedule, new Date(), selectedTaxPeriodOffset),
    [selectedTaxPeriodOffset, taxSettings.filingSchedule]
  )
  const selectedTaxPeriod = useMemo(
    () => buildSalesTaxPeriodSummaries(dbTransactions || [], itemsByTransactionId, taxSettings, selectedTaxPeriodDate, 1)[0],
    [dbTransactions, itemsByTransactionId, taxSettings, selectedTaxPeriodDate]
  )
  const selectedTaxPeriodOverdue =
    selectedTaxPeriod ? isSalesTaxPeriodOverdue(selectedTaxPeriod, new Date()) : false
  const salesTaxHistoryPeriods = useMemo(() => {
    const base = buildSalesTaxPeriodSummaries(dbTransactions || [], itemsByTransactionId, taxSettings, new Date(), 12)
    const periodMap = new Map(base.map((period) => [period.periodKey, period]))

    for (const entry of taxSettings.filingHistory) {
      if (periodMap.has(entry.periodKey)) continue
      periodMap.set(entry.periodKey, {
        periodKey: entry.periodKey,
        periodLabel: entry.periodLabel ?? entry.periodKey,
        startDate: entry.startDate ?? '',
        endDate: entry.endDate ?? '',
        dueDate: entry.dueDate ?? '',
        totalSales: entry.totalSales ?? 0,
        taxableSales: entry.taxableSales ?? 0,
        taxCollected: entry.taxCollected ?? 0,
        status: entry.status,
        filedAt: entry.filedAt,
        paidAt: entry.paidAt,
        confirmationNumber: entry.confirmationNumber,
        notes: entry.notes,
      })
    }

    return [...periodMap.values()].sort((left, right) => right.startDate.localeCompare(left.startDate))
  }, [dbTransactions, itemsByTransactionId, taxSettings])

  const parseDate = (date: string) => new Date(date + "T00:00:00")
  const monthKey = (date: Date) => date.toLocaleString("en-US", { month: "short" }).toUpperCase()
  const totals = paymentsLedger.reduce(
    (acc, payment) => {
      if (payment.eventType !== 'payment') {
        return acc
      }
      const date = new Date(payment.createdAt)
      if (date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear()) {
        acc.monthPayments += payment.grossAmount
      }
      acc.totalPayments += payment.grossAmount
      return acc
    },
    { monthPayments: 0, totalPayments: 0 }
  )
  const expenseTotals = expenses.reduce(
    (acc, expense) => {
      const date = parseDate(expense.date)
      if (date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear()) {
        acc.monthExpenses += expense.amount
      }
      acc.totalExpenses += expense.amount
      if (expense.status === "Pending") {
        acc.pending += expense.amount
      }
      return acc
    },
    { monthExpenses: 0, totalExpenses: 0, pending: 0 }
  )

  const monthlyData = (() => {
    const map = new Map<string, { revenue: number; expenses: number }>()
    paymentsLedger.forEach((payment) => {
      if (payment.eventType !== 'payment') {
        return
      }
      const date = new Date(payment.createdAt)
      const key = monthKey(date)
      const entry = map.get(key) || { revenue: 0, expenses: 0 }
      entry.revenue += payment.grossAmount
      map.set(key, entry)
    })
    expenses.forEach((expense) => {
      const date = parseDate(expense.date)
      const key = monthKey(date)
      const entry = map.get(key) || { revenue: 0, expenses: 0 }
      entry.expenses += expense.amount
      map.set(key, entry)
    })
    return Array.from(map.entries()).map(([month, values]) => ({
      month: `${month} ${new Date().getFullYear()}`,
      shortMonth: month,
      revenue: values.revenue,
      expenses: values.expenses,
      profit: values.revenue - values.expenses
    }))
  })()
  const monthlyExpenses = monthlyData.map((entry) => ({ month: entry.shortMonth, amount: entry.expenses }))
  const averageMonthlyExpense = monthlyExpenses.length > 0
    ? Math.round(monthlyExpenses.reduce((sum, entry) => sum + entry.amount, 0) / monthlyExpenses.length)
    : 0
  const expenseBreakdown = (() => {
    const totals = new Map<string, number>()
    expenses.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount))
    const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0) || 1
    const palette = [
      'oklch(0.70 0.25 200)',
      'oklch(0.75 0.25 330)',
      'oklch(0.72 0.24 85)',
      'oklch(0.68 0.22 280)',
      'oklch(0.76 0.23 25)'
    ]
    return Array.from(totals.entries()).map(([category, amount], index) => ({
      category,
      amount,
      percentage: Math.round((amount / total) * 100),
      color: palette[index % palette.length]
    }))
  })()
  const recentExpenses = [...expenses].slice(-5).reverse()
  const pendingBills = expenses.filter((expense) => expense.status === "Pending")

  useEffect(() => {
    if (savedTaxSettings) {
      setTaxSettings(savedTaxSettings)
    }
  }, [savedTaxSettings])

  useEffect(() => {
    if (!payoutData) return
    setPayoutRows(payoutData.payouts ?? [])
    setPayoutCursor(payoutData.next_cursor)
    setPayoutHasMore(payoutData.has_more)
  }, [payoutData])

  useEffect(() => {
    setSelectedTaxPeriodOffset(0)
  }, [taxSettings.filingSchedule])

  useEffect(() => {
    setTaxEditor({
      filedAt: selectedTaxPeriod?.filedAt ?? '',
      paidAt: selectedTaxPeriod?.paidAt ?? '',
      confirmationNumber: selectedTaxPeriod?.confirmationNumber ?? '',
      notes: selectedTaxPeriod?.notes ?? '',
    })
  }, [selectedTaxPeriod?.periodKey, selectedTaxPeriod?.filedAt, selectedTaxPeriod?.paidAt, selectedTaxPeriod?.confirmationNumber, selectedTaxPeriod?.notes])

  const payoutSummary = payoutData ?? null
  const payoutDestinationLabel = useMemo(() => {
    const accounts = payoutSummary?.external_accounts ?? []
    if (!accounts.length) return 'No external payout destination'
    return accounts
      .map((account) => {
        const heading = account.object === 'bank_account' ? account.bank_name || 'Bank account' : account.brand || 'Card'
        return `${heading} •••• ${account.last4 ?? '—'}`
      })
      .join(', ')
  }, [payoutSummary?.external_accounts])

  const filteredPayoutRows = useMemo(
    () => [...payoutRows].sort((left, right) => right.created - left.created),
    [payoutRows],
  )

  const saveTaxPeriodEntry = async (status: SalesTaxPeriodStatus, overrides?: Partial<typeof taxEditor>) => {
    if (!selectedTaxPeriod) return
    const nextEditor = { ...taxEditor, ...overrides }
    const entry = {
      periodKey: selectedTaxPeriod.periodKey,
      periodLabel: selectedTaxPeriod.periodLabel,
      startDate: selectedTaxPeriod.startDate,
      endDate: selectedTaxPeriod.endDate,
      dueDate: selectedTaxPeriod.dueDate,
      totalSales: selectedTaxPeriod.totalSales,
      taxableSales: selectedTaxPeriod.taxableSales,
      taxCollected: selectedTaxPeriod.taxCollected,
      status,
      filedAt: nextEditor.filedAt || undefined,
      paidAt: nextEditor.paidAt || undefined,
      confirmationNumber: nextEditor.confirmationNumber || undefined,
      notes: nextEditor.notes || undefined,
    }

    const nextSettings = upsertSalesTaxHistoryEntry(taxSettings, entry)
    await paymentClient.setPosSettings({ sales_tax: nextSettings })
    setTaxSettings(nextSettings)
    setTaxEditor(nextEditor)
  }

  const pendingTaxActionConfig = (() => {
    if (!pendingTaxAction || !selectedTaxPeriod) return null

    switch (pendingTaxAction) {
      case 'filed':
        return {
          title: 'Mark this tax period as filed?',
          description: `This will update ${selectedTaxPeriod.periodLabel} to filed and keep the entered filing details for this period.`,
          confirmLabel: 'Yes, Mark as Filed',
        }
      case 'paid':
        return {
          title: 'Mark this tax period as paid?',
          description: `This will mark ${selectedTaxPeriod.periodLabel} as paid and keep the entered filing and payment details for this period.`,
          confirmLabel: 'Yes, Mark as Paid',
        }
      case 'unfiled':
        return {
          title: 'Reset this tax period to unfiled?',
          description: `This will clear the filing details for ${selectedTaxPeriod.periodLabel} and set it back to unfiled.`,
          confirmLabel: 'Yes, Reset to Unfiled',
        }
      case 'save':
        return {
          title: 'Save filing details for this tax period?',
          description: `This will save the current filing details for ${selectedTaxPeriod.periodLabel} without changing its status.`,
          confirmLabel: 'Yes, Save Details',
        }
    }
  })()

  const openTaxActionConfirmation = (action: TaxActionKey) => {
    setPendingTaxAction(action)
    setTaxActionDialogOpen(true)
  }

  const handleConfirmTaxAction = async () => {
    const action = pendingTaxAction
    if (!action || !selectedTaxPeriod) return

    setTaxActionDialogOpen(false)
    setPendingTaxAction(null)

    try {
      if (action === 'filed') {
        await saveTaxPeriodEntry('filed', { filedAt: taxEditor.filedAt || getTodayInBusinessTimezone() })
        toast.success('Marked as filed')
        return
      }

      if (action === 'paid') {
        const today = getTodayInBusinessTimezone()
        await saveTaxPeriodEntry('paid', { filedAt: taxEditor.filedAt || today, paidAt: taxEditor.paidAt || today })
        toast.success('Marked as paid')
        return
      }

      if (action === 'unfiled') {
        await saveTaxPeriodEntry('unfiled', { filedAt: '', paidAt: '', confirmationNumber: '', notes: '' })
        toast.success('Reset to unfiled')
        return
      }

      await saveTaxPeriodEntry(selectedTaxPeriod.status)
      toast.success('Filing details saved')
    } catch (error) {
      if (action === 'unfiled') {
        toast.error('Failed to reset tax period')
      } else if (action === 'save') {
        toast.error('Failed to save filing details')
      } else {
        toast.error('Failed to update tax period')
      }
      console.error(error)
    }
  }

  const setFinancesTab = (tab: FinancesTabKey) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tab', tab)
      return next
    })
  }

  const toggleDisputeSort = (key: 'respondBy' | 'disputedOn' | 'status' | 'reason' | 'from' | 'amount') => {
    setDisputeSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: key === 'amount' ? 'desc' : 'asc' }
    })
  }

  const openDisputeDetails = (entry: PaymentLedgerEntry) => {
    setSelectedDispute(entry)
    setEvidenceNotes(entry.notes ?? '')
    setDisputeDetailsOpen(true)
  }

  const submitEvidence = async () => {
    if (!selectedDispute?.stripeDisputeId) return
    try {
      await submitDisputeEvidence.mutateAsync({ disputeId: selectedDispute.stripeDisputeId, notes: evidenceNotes.trim() })
      toast.success('Dispute evidence submitted to Stripe')
      setDisputeDetailsOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit dispute evidence')
    }
  }

  return (
    <div data-testid="page-finances" className="min-h-full bg-background text-foreground p-3 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setFinancesTab(normalizeFinancesTab(value))}
          className="space-y-4 md:space-y-6"
        >
          <ScrollArea className="w-full">
              <TabsList className="bg-card border border-border h-10 md:h-12 w-full inline-flex">
                <TabsTrigger value="dashboard" className="gap-1 md:gap-2 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <SquaresFour size={isMobile ? 16 : 18} />
                  {!isMobile && 'Overview'}
                </TabsTrigger>
              <TabsTrigger value="expenses" className="gap-1 md:gap-2 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Circle size={isMobile ? 16 : 18} />
                {!isMobile && 'Expenses'}
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-1 md:gap-2 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <CreditCard size={isMobile ? 16 : 18} />
                {!isMobile && 'Payments'}
              </TabsTrigger>
              <TabsTrigger value="payouts" className="gap-1 md:gap-2 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Wallet size={isMobile ? 16 : 18} />
                {!isMobile && 'Payouts'}
              </TabsTrigger>
              <TabsTrigger value="payroll" className="gap-1 md:gap-2 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users size={isMobile ? 16 : 18} />
                {!isMobile && 'Payroll'}
              </TabsTrigger>
              <TabsTrigger value="taxes" className="gap-1 md:gap-2 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Receipt size={isMobile ? 16 : 18} />
                {!isMobile && 'Taxes'}
              </TabsTrigger>
              <TabsTrigger value="disputes" className="gap-1 md:gap-2 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Gavel size={isMobile ? 16 : 18} />
                {!isMobile && 'Disputes'}
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="dashboard" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <Card className="p-2 md:p-2.5 border-border cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/finances?tab=expenses')}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">BILLS</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">$0</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 shrink-0">REVIEW</Button>
                </div>
              </Card>

              <Card className="p-2 md:p-2.5 border-border cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/finances?tab=payments')}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">PAYMENTS</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">${totals.totalPayments.toLocaleString()}</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 shrink-0">LEDGER</Button>
                </div>
              </Card>

              <Card className="p-2 md:p-2.5 border-border cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/finances?tab=taxes')}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">SALES TAX</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">
                      ${salesTaxSummary.thisYear.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 shrink-0">TAXES</Button>
                </div>
              </Card>

              <Card className="p-2 md:p-2.5 border-border cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/finances?tab=payroll')}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">PAYROLL</p>
                    <p className="text-sm md:text-base font-bold mt-0.5">Not scheduled</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 shrink-0">OPEN</Button>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Card className="p-4 md:p-6 border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm uppercase tracking-wider text-muted-foreground font-medium mb-1">
                      MONEY IN (THIS MONTH)
                    </p>
                    <p className="text-3xl md:text-4xl font-bold mt-2 truncate">
                      ${totals.monthPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <TrendUp size={14} className="text-muted-foreground flex-shrink-0" weight="bold" />
                      <p className="text-xs text-muted-foreground font-medium truncate">No prior data</p>
                    </div>
                  </div>
                  <TrendUp size={isMobile ? 18 : 20} className="text-green-500 flex-shrink-0 ml-2" weight="bold" />
                </div>
              </Card>

              <Card className="p-4 md:p-6 border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm uppercase tracking-wider text-muted-foreground font-medium mb-1">
                      MONEY OUT (THIS MONTH)
                    </p>
                    <p className="text-3xl md:text-4xl font-bold mt-2 truncate">
                      ${expenseTotals.monthExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <TrendUp size={14} className="text-muted-foreground flex-shrink-0" weight="bold" />
                      <p className="text-xs text-muted-foreground font-medium truncate">No prior data</p>
                    </div>
                  </div>
                  <TrendUp size={isMobile ? 18 : 20} className="text-green-500 flex-shrink-0 ml-2" weight="bold" />
                </div>
              </Card>

              <Card className="p-4 md:p-6 border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm uppercase tracking-wider text-muted-foreground font-medium mb-1">
                      WHAT'S LEFT (THIS MONTH)
                    </p>
                    <p className="text-3xl md:text-4xl font-bold mt-2 truncate">
                      ${(totals.monthPayments - expenseTotals.monthExpenses).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <TrendUp size={14} className="text-muted-foreground flex-shrink-0" weight="bold" />
                      <p className="text-xs text-muted-foreground font-medium truncate">No prior data</p>
                    </div>
                  </div>
                  <TrendUp size={isMobile ? 18 : 20} className="text-green-500 flex-shrink-0 ml-2" weight="bold" />
                </div>
              </Card>
            </div>

            <Card className="p-4 md:p-6 border-border">
              <div className="mb-4">
                <h3 className="text-base md:text-lg font-bold">Monthly Overview</h3>
                <p className="text-xs md:text-sm text-muted-foreground">Revenue, expenses, and profit trends for the last six months.</p>
              </div>
              <FinancialChart data={monthlyData} />
              {isMobile && (
                <div className="mt-4 flex flex-wrap gap-3 justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'oklch(0.65 0.22 220)' }}></div>
                    <span className="text-xs font-medium">REVENUE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'oklch(0.60 0.20 25)' }}></div>
                    <span className="text-xs font-medium">EXPENSES</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'oklch(0.70 0.20 140)' }}></div>
                    <span className="text-xs font-medium">PROFIT</span>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">MTD EXPENSES</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">${expenseTotals.monthExpenses.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">YTD EXPENSES</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">${expenseTotals.totalExpenses.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">PENDING</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">${expenseTotals.pending.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">AVG MONTHLY</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">${averageMonthlyExpense.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-2 max-h-[calc(100dvh-280px)]">
              <Card className="lg:col-span-4 border-border flex flex-col">
                <div className="p-2.5 border-b border-border flex-shrink-0">
                  <h3 className="text-sm font-bold">Expense Trend</h3>
                  <p className="text-xs text-muted-foreground">Last 6 Months</p>
                </div>
                <div className="p-2.5 flex-1 min-h-0">
                  <div className="relative h-full min-h-[160px]">
                    <div className="absolute inset-0 flex items-end justify-between gap-2 pb-8 pr-16">
                      {monthlyExpenses.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                          No expense history yet
                        </div>
                      ) : (
                        <>
                          {/* Placeholder bars for months before real data to avoid single wide bar */}
                          {monthlyExpenses.length < 6 && Array.from({ length: Math.min(3, 6 - monthlyExpenses.length) }).map((_, i) => (
                            <div key={`placeholder-${i}`} className="flex-1 flex flex-col items-center gap-2 opacity-30">
                              <div className="relative w-full" style={{ height: '25%', minHeight: '20px' }}>
                                <div 
                                  className="absolute bottom-0 w-full rounded-t-lg"
                                  style={{ 
                                    height: '100%',
                                    backgroundColor: 'oklch(0.70 0.20 195 / 0.3)',
                                    border: '1px dashed oklch(0.70 0.20 195 / 0.5)'
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium text-muted-foreground/50">--</span>
                            </div>
                          ))}
                          {monthlyExpenses.map((data, i) => {
                            const maxExpense = Math.max(...monthlyExpenses.map(m => m.amount))
                            const height = maxExpense > 0 ? (data.amount / maxExpense) * 100 : 0
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                <div className="relative w-full" style={{ height: `${height}%`, minHeight: '20px' }}>
                                  <div 
                                    className="absolute bottom-0 w-full rounded-t-lg transition-all hover:brightness-110 cursor-pointer"
                                    style={{ 
                                      height: '100%',
                                      backgroundColor: 'oklch(0.70 0.20 195)',
                                      boxShadow: '0 0 15px oklch(0.70 0.20 195 / 0.3)',
                                      maxWidth: monthlyExpenses.length === 1 ? '80px' : undefined,
                                      marginLeft: monthlyExpenses.length === 1 ? 'auto' : undefined,
                                      marginRight: monthlyExpenses.length === 1 ? 'auto' : undefined
                                    }}
                                  />
                                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs font-bold text-foreground whitespace-nowrap">${data.amount}</span>
                                  </div>
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">{data.month}</span>
                              </div>
                            )
                          })}
                        </>
                      )}
                    </div>
                    
                    <div className="absolute inset-x-0 flex items-center pointer-events-none" style={{ bottom: '45%', right: '0' }}>
                      <div className="w-full border-t-2 border-dashed border-primary opacity-60" />
                      <div className="absolute -right-2 translate-x-full flex items-center gap-2 bg-background pl-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-xs font-medium text-primary whitespace-nowrap">Avg</span>
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-start gap-4 pt-2 border-t border-border mt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-3 rounded" style={{ backgroundColor: 'oklch(0.70 0.20 195)' }} />
                        <span className="text-xs font-medium">Expenses</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-xs font-medium">Average</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="lg:col-span-3 border-border flex flex-col">
                <div className="p-2.5 border-b border-border flex items-center justify-between flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold">Upcoming Bills</h3>
                    <p className="text-xs text-muted-foreground">Next 30 Days</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-1 text-xs h-7 px-2 hover:bg-primary/10 hover:text-primary transition-all"
                    onClick={() => navigate('/finances/upcoming-bills')}
                  >
                    View All
                    <CaretRight size={12} weight="bold" />
                  </Button>
                </div>
                <div className="p-2.5 flex-1 min-h-0 overflow-auto">
                  <div className="space-y-1">
                    <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-2 pb-2">
                      <span>Vendor</span>
                      <span className="text-center">Due In</span>
                      <span className="text-right">Amount</span>
                      <span className="text-right">Status</span>
                    </div>
                    {pendingBills.length === 0 ? (
                      <div className="text-sm text-muted-foreground px-2 py-3">No upcoming bills yet.</div>
                    ) : (
                      pendingBills.map((bill) => {
                        const dueDate = new Date(bill.date + "T00:00:00")
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const diffTime = dueDate.getTime() - today.getTime()
                        const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                        const isOverdue = daysUntilDue < 0
                        const isDueSoon = daysUntilDue <= 3 && daysUntilDue >= 0
                        const dueInText = isOverdue 
                          ? `${Math.abs(daysUntilDue)} days ago` 
                          : daysUntilDue === 0 
                            ? 'Today' 
                            : daysUntilDue === 1 
                              ? '1 day' 
                              : `${daysUntilDue} days`
                        return (
                          <div key={bill.id} className="grid grid-cols-4 gap-2 p-2 hover:bg-muted/50 transition-colors cursor-pointer rounded">
                            <span className="text-sm font-medium truncate">{bill.vendor}</span>
                            <span className="text-sm text-center flex items-center justify-center gap-1">
                              {dueInText}
                              {(isOverdue || isDueSoon) && <Circle size={8} className={isOverdue ? "text-red-500" : "text-yellow-500"} weight="fill" />}
                            </span>
                            <span className="text-sm font-bold text-right">${bill.amount.toFixed(2)}</span>
                            <span className={`text-xs px-2 py-1 rounded-full w-fit font-medium ml-auto ${
                              bill.status === 'Paid' 
                                ? 'bg-green-500/30 text-green-400' 
                                : 'bg-yellow-500/30 text-yellow-300'
                            }`}>
                              {bill.status}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </Card>

              <Card className="lg:col-span-3 border-border/60 flex flex-col bg-card/80 backdrop-blur-sm overflow-hidden">
                <div className="p-2.5 border-b border-border/50 flex items-center justify-between flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold">Expense Breakdown</h3>
                    <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="p-3 flex flex-col lg:flex-row items-center gap-3 flex-1 min-h-0">
                  <div className="relative flex-shrink-0" style={{ width: '200px', height: '200px' }}>
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
                      {(() => {
                        const radius = 65
                        const circumference = 2 * Math.PI * radius
                        let currentOffset = 0
                        return expenseBreakdown.map((item, i) => {
                          const offset = currentOffset
                          const dashArray = (item.percentage / 100) * circumference
                          currentOffset += dashArray
                          return (
                            <circle
                              key={i}
                              cx="100"
                              cy="100"
                              r={radius}
                              fill="none"
                              stroke={item.color}
                              strokeWidth="35"
                              strokeDasharray={`${dashArray} ${circumference}`}
                              strokeDashoffset={-offset}
                              className="transition-all duration-300 hover:brightness-110 cursor-pointer"
                            />
                          )
                        })
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold tabular-nums">
                        ${(expenseBreakdown.reduce((sum, item) => sum + item.amount, 0) / 1000).toFixed(1).replace(/\.0$/, '')}k
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 w-full space-y-0.5">
                    {expenseBreakdown.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No expenses yet.</div>
                    ) : (
                      expenseBreakdown.map((item, i) => (
                        <div key={i} className="flex items-center hover:bg-muted/40 p-1 rounded-md transition-all cursor-pointer group">
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div 
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform" 
                              style={{ 
                                backgroundColor: item.color,
                                boxShadow: `0 0 8px ${item.color}`
                              }} 
                            />
                            <span className="text-xs font-semibold">{item.category}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                            <span className="text-sm font-bold tabular-nums">${(item.amount / 1000).toFixed(1).replace(/\.0$/, '')}k</span>
                            <span className="text-xs text-muted-foreground w-7 text-right font-semibold">{item.percentage}%</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>

              <Card className="lg:col-span-4 border-border flex flex-col">
                <div className="p-2.5 border-b border-border flex items-center justify-between flex-shrink-0">
                  <h3 className="text-sm font-bold">Recent Expenses</h3>
                  <div className="flex items-center gap-2">
                    <Button 
                      data-testid="finances-add-expense"
                      size="sm" 
                      className="gap-1 text-xs h-7 px-2"
                      onClick={() => navigate('/finances/add-expense')}
                    >
                      Add Expense
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => navigate('/finances/all-expenses')}
                    >
                      View All
                    </Button>
                  </div>
                </div>
                <div className="p-2.5 flex-1 min-h-0 overflow-auto">
                  <div className="space-y-1">
                    <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground px-2 pb-2">
                      <span>Category</span>
                      <span>Vendor</span>
                      <span>Date</span>
                      <span>Status</span>
                      <span className="text-right">Amount</span>
                    </div>
                    {recentExpenses.length === 0 ? (
                      <div className="text-sm text-muted-foreground px-2 py-3">No expenses recorded yet.</div>
                    ) : (
                      recentExpenses.map((expense) => (
                        <div key={expense.id} className="grid grid-cols-5 gap-2 p-2 hover:bg-muted/50 transition-colors cursor-pointer rounded">
                        <span className="text-sm truncate">{expense.category}</span>
                        <span className="text-sm truncate">{expense.vendor}</span>
                        <span className="text-sm">{formatDateForDisplay(expense.date)}</span>
                        <span className={`text-xs px-2 py-1 rounded-full w-fit font-medium ${
                          expense.status === 'Paid' 
                            ? 'bg-green-500/30 text-green-400' 
                            : 'bg-yellow-500/30 text-yellow-300'
                        }`}>
                          {expense.status}
                        </span>
                        <span className="text-sm font-semibold text-right">${expense.amount.toFixed(2)}</span>
                      </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">TOTAL COLLECTED</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">${paymentsLedgerSummary.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">CASH</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">${paymentsLedgerSummary.cashCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">CARD COLLECTED</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">${paymentsLedgerSummary.cardCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">REFUNDED</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">
                      ${paymentsLedgerSummary.refunded.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">OPEN DISPUTES</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">
                      {paymentsLedgerSummary.openDisputes}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="border-border">
              <div className="p-3 md:p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm md:text-base font-bold">Payments Activity Ledger</h3>
              </div>
              <div className="px-3 md:px-4 py-3 border-b border-border flex flex-wrap gap-2">
                {([
                  ['all', 'All activity'],
                  ['payments', 'Payments'],
                  ['refunds', 'Refunds'],
                  ['disputes', 'Disputes'],
                  ['cash', 'Cash'],
                  ['card', 'Card'],
                ] as const).map(([filterKey, label]) => (
                  <Button
                    key={filterKey}
                    size="sm"
                    variant={paymentsLedgerFilter === filterKey ? 'default' : 'outline'}
                    onClick={() => setPaymentsLedgerFilter(filterKey)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="divide-y divide-border">
                {filteredPaymentsLedger.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">No activity in this view yet.</div>
                )}
                {filteredPaymentsLedger.map((payment) => {
                  const badgeLabel = payment.eventType === 'failed_payment'
                    ? 'Failed Payment'
                    : payment.eventType[0].toUpperCase() + payment.eventType.slice(1)
                  const statusClass = payment.eventType === 'refund'
                    ? 'bg-amber-500/20 text-amber-300'
                    : payment.eventType === 'dispute'
                      ? 'bg-destructive/20 text-destructive'
                      : payment.eventType === 'failed_payment'
                        ? 'bg-destructive/20 text-destructive'
                        : 'bg-green-500/20 text-green-300'
                  const amountPrefix =
                    payment.eventType === 'refund' || payment.eventType === 'dispute' ? '-' : ''

                  return (
                    <div
                      key={payment.id}
                      className="p-3 md:p-4 hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedPayment(payment)
                        setPaymentDialogOpen(true)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          setSelectedPayment(payment)
                          setPaymentDialogOpen(true)
                        }
                      }}
                    >
                      <div className="flex items-start md:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                            <p className="font-medium text-sm md:text-base truncate">{payment.clientName}</p>
                            <span className={`text-xs px-2 py-1 rounded-full w-fit ${statusClass}`}>
                              {badgeLabel}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground w-fit">
                              {payment.paymentMethodLabel || 'Unknown'}
                            </span>
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                            {payment.petNames && payment.petNames.length > 0 ? (
                              <>
                                <span>{payment.serviceLabel || 'Payment'} -</span>
                                {payment.petNames.map((dog, dogIndex) => (
                                  <span key={dogIndex} className="inline-flex items-center gap-1">
                                    <PawPrint size={14} weight="fill" className="text-primary flex-shrink-0" />
                                    <span>{dog}</span>
                                    {dogIndex < payment.petNames.length - 1 && <span className="ml-1">&</span>}
                                  </span>
                                ))}
                              </>
                            ) : (
                              <span>{payment.serviceLabel || 'Payment activity'}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDateForDisplay(payment.createdAt.slice(0, 10))} • {payment.status}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-base md:text-lg font-bold">{amountPrefix}${payment.grossAmount.toFixed(2)}</p>
                          {payment.tipAmount > 0 && (
                            <p className="text-xs text-muted-foreground">+${payment.tipAmount.toFixed(2)} tip</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="space-y-3">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <Card className="p-2 md:p-2.5 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Payouts Enabled</p>
                      <p className="text-lg md:text-xl font-bold mt-0.5">
                        {payoutError ? 'Unavailable' : !payoutData ? '—' : payoutSummary?.payouts_enabled ? 'Yes' : 'No'}
                      </p>
                      {payoutError ? (
                        <p className="text-xs text-destructive mt-0.5">Unable to load payout status</p>
                      ) : payoutSummary?.disabled_reason ? (
                        <p className="text-xs text-destructive mt-0.5">{payoutSummary.disabled_reason.replace(/_/g, ' ')}</p>
                      ) : null}
                    </div>
                  </div>
                </Card>
                <Card className="p-2 md:p-2.5 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Payout Schedule</p>
                      <p className="text-lg md:text-xl font-bold mt-0.5 capitalize">
                        {payoutError ? 'Unavailable' : !payoutData ? '—' : payoutSummary?.payout_schedule?.interval ?? '—'}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="p-2 md:p-2.5 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Next Expected Payout</p>
                      <p className="text-lg md:text-xl font-bold mt-0.5 truncate">
                        {payoutError
                          ? 'Unavailable'
                          : !payoutData
                            ? '—'
                            : payoutSummary?.next_payout
                              ? formatCurrency(payoutSummary.next_payout.amount, payoutSummary.next_payout.currency)
                              : 'Not determinable'}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="p-2 md:p-2.5 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Last Payout</p>
                      <p className="text-lg md:text-xl font-bold mt-0.5 truncate">
                        {payoutError
                          ? 'Unavailable'
                          : !payoutData
                            ? '—'
                            : payoutSummary?.last_payout
                              ? formatCurrency(payoutSummary.last_payout.amount, payoutSummary.last_payout.currency)
                              : '—'}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="p-2 md:p-2.5 border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pending Total</p>
                      <p className="text-lg md:text-xl font-bold mt-0.5">
                        {payoutError
                          ? 'Unavailable'
                          : !payoutData
                            ? '—'
                            : formatCurrency(payoutSummary?.pending_payout_total, payoutSummary?.pending_currency ?? 'usd')}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="border-border p-4 md:p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold">Payout Operations</h2>
                    <p className="text-sm text-muted-foreground">Live Stripe payout status, destination, and history.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refetchPayouts()}
                    disabled={payoutRefetching}
                    aria-label="Refresh payouts"
                  >
                    <ArrowsClockwise size={14} className="mr-1" />
                    {payoutRefetching ? 'Refreshing…' : 'Refresh'}
                  </Button>
                </div>

              <Card className="p-4 border-border bg-card">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Destination</p>
                <p className="text-sm md:text-base font-semibold mt-2">{payoutDestinationLabel}</p>
              </Card>

              {payoutError ? (
                <Card className="p-4 border-destructive/50 bg-destructive/5 text-sm text-destructive">
                  Unable to load payouts right now. Refresh to retry.
                </Card>
              ) : null}

              <Card className="border-border overflow-x-auto">
                <div className="min-w-[1180px]">
                  <div className="grid grid-cols-[1fr_1fr_1fr_2fr_2fr_1fr_1fr_1fr_1fr] gap-3 p-3 text-sm font-semibold text-muted-foreground border-b border-border">
                    <span>Payout Date</span>
                    <span>Arrival</span>
                    <span>Status</span>
                    <span>Destination</span>
                    <span>Payout ID</span>
                    <span>Method</span>
                    <span className="text-right">Gross</span>
                    <span className="text-right">Fees</span>
                    <span className="text-right">Net</span>
                  </div>
                  <div className="divide-y divide-border">
                    {payoutLoading ? (
                      Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="grid grid-cols-[1fr_1fr_1fr_2fr_2fr_1fr_1fr_1fr_1fr] gap-3 p-3 items-center">
                          {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className="h-6 w-20 rounded-md bg-muted animate-pulse" />
                          ))}
                        </div>
                      ))
                    ) : filteredPayoutRows.length === 0 ? (
                      <div className="p-6 text-sm text-muted-foreground">No payouts match current filters.</div>
                    ) : (
                      filteredPayoutRows.map((payout) => (
                        <button
                          key={payout.id}
                          type="button"
                          className={`grid w-full grid-cols-[1fr_1fr_1fr_2fr_2fr_1fr_1fr_1fr_1fr] gap-3 p-3 items-center text-left hover:bg-muted/40 ${
                            payout.status === 'failed' ? 'bg-destructive/5' : ''
                          }`}
                          onClick={() => setSelectedPayout(payout)}
                        >
                          <span>{formatUnixDate(payout.created)}</span>
                          <span>{formatUnixDate(payout.arrival_date)}</span>
                          <span className={`inline-flex items-center gap-1 ${payout.status === 'failed' ? 'text-destructive font-medium' : ''}`}>
                            {payout.status === 'failed' ? <WarningCircle size={14} weight="fill" /> : null}
                            {payout.status}
                          </span>
                          <span className="truncate">{payout.destination_label ?? '—'}</span>
                          <span className="truncate">{payout.id}</span>
                          <span className="capitalize">{payout.method || payout.type}</span>
                          <span className="text-right">{formatCurrency(payout.gross_amount, payout.currency)}</span>
                          <span className="text-right">{formatCurrency(payout.fees, payout.currency)}</span>
                          <span className="text-right font-semibold">{formatCurrency(payout.net_amount, payout.currency)}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </Card>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing {filteredPayoutRows.length} of {payoutRows.length} loaded payouts
                </p>
                <Button size="sm" variant="outline" disabled={!payoutHasMore || payoutLoadingMore} onClick={() => void handleLoadMorePayouts()}>
                  {payoutLoadingMore ? 'Loading…' : payoutHasMore ? 'Load more' : 'All loaded'}
                </Button>
              </div>
              </Card>
            </div>

            <Dialog open={!!selectedPayout} onOpenChange={(open) => !open && setSelectedPayout(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Payout details
                    {selectedPayout?.status === 'failed' ? (
                      <Badge variant="destructive" className="gap-1">
                        <WarningCircle size={12} weight="fill" />
                        Failed
                      </Badge>
                    ) : null}
                  </DialogTitle>
                  <DialogDescription>
                    Stripe payout {selectedPayout?.id}
                  </DialogDescription>
                </DialogHeader>
                {selectedPayout ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Payout ID</span><span className="font-medium">{selectedPayout.id}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Status</span><span className={selectedPayout.status === 'failed' ? 'font-medium text-destructive' : 'font-medium'}>{selectedPayout.status}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Amount</span><span className="font-medium">{formatCurrency(selectedPayout.amount, selectedPayout.currency)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Currency</span><span className="font-medium uppercase">{selectedPayout.currency}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Created</span><span className="font-medium">{formatUnixDate(selectedPayout.created)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Expected Arrival</span><span className="font-medium">{formatUnixDate(selectedPayout.arrival_date)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Method / Type</span><span className="font-medium">{selectedPayout.method} / {selectedPayout.type}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Statement Descriptor</span><span className="font-medium">{selectedPayout.statement_descriptor ?? '—'}</span></div>
                    <div className="flex justify-between gap-3 md:col-span-2"><span className="text-muted-foreground">Destination</span><span className="font-medium">{selectedPayout.destination_label ?? selectedPayout.destination_id ?? '—'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Gross</span><span className="font-medium">{formatCurrency(selectedPayout.gross_amount, selectedPayout.currency)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Fees</span><span className="font-medium">{formatCurrency(selectedPayout.fees, selectedPayout.currency)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Net</span><span className="font-medium">{formatCurrency(selectedPayout.net_amount, selectedPayout.currency)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Balance Txn</span><span className="font-medium">{selectedPayout.balance_transaction_id ?? '—'}</span></div>
                    {selectedPayout.status === 'failed' ? (
                      <div className="md:col-span-2 rounded-md border border-destructive/60 bg-destructive/10 p-3 text-destructive">
                        <p className="font-semibold">Failure reason</p>
                        <p className="text-sm mt-1">{selectedPayout.failure_message ?? selectedPayout.failure_code ?? 'No reason returned by Stripe.'}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="payroll" className="space-y-3">
            <PayrollOverview />
          </TabsContent>

          <TabsContent value="taxes" className="space-y-3">
            {!taxSettings.collectSalesTax ? (
              <Card className="p-6 border-border">
                <h3 className="text-lg font-bold">Sales tax tracking is disabled</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Enable sales tax collection in POS settings to activate filing-period calculations and filing workflow.
                </p>
              </Card>
            ) : (
              <>
                {selectedTaxPeriod && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      <Card className="p-2 md:p-2.5 border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">TOTAL SALES</p>
                            <p className="text-lg md:text-xl font-bold mt-0.5">${selectedTaxPeriod.totalSales.toFixed(2)}</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-2 md:p-2.5 border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">TAXABLE SALES</p>
                            <p className="text-lg md:text-xl font-bold mt-0.5">${selectedTaxPeriod.taxableSales.toFixed(2)}</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-2 md:p-2.5 border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">TAX COLLECTED</p>
                            <p className="text-lg md:text-xl font-bold mt-0.5">${selectedTaxPeriod.taxCollected.toFixed(2)}</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-2 md:p-2.5 border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">FILING STATUS</p>
                            <p className="text-lg md:text-xl font-bold mt-0.5 capitalize">
                              {selectedTaxPeriodOverdue ? 'Overdue' : selectedTaxPeriod.status}
                            </p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-2 md:p-2.5 border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">DUE DATE</p>
                            <p className="text-lg md:text-xl font-bold mt-0.5">{formatDateForDisplay(selectedTaxPeriod.dueDate)}</p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <Card className="p-4 md:p-6 border-border">
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <h3 className="text-lg font-bold">Selected Period Filing Workflow</h3>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedTaxPeriodOffset((current) => current - 1)}>
                              Previous
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setSelectedTaxPeriodOffset((current) => current + 1)}>
                              Next
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Period</span><span className="font-medium">{selectedTaxPeriod.periodLabel}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span className="font-medium">{selectedTaxPeriod.dueDate ? formatDateForDisplay(selectedTaxPeriod.dueDate) : '—'}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Total Sales</span><span className="font-medium">${selectedTaxPeriod.totalSales.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Taxable Sales</span><span className="font-medium">${selectedTaxPeriod.taxableSales.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Tax Collected</span><span className="font-medium">${selectedTaxPeriod.taxCollected.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium capitalize">{selectedTaxPeriod.status}</span></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="tax-filed-at">Filed Date</Label>
                            <Input id="tax-filed-at" type="date" value={taxEditor.filedAt} onChange={(event) => setTaxEditor((current) => ({ ...current, filedAt: event.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tax-paid-at">Paid Date</Label>
                            <Input id="tax-paid-at" type="date" value={taxEditor.paidAt} onChange={(event) => setTaxEditor((current) => ({ ...current, paidAt: event.target.value }))} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="tax-confirmation">Confirmation Number</Label>
                            <Input id="tax-confirmation" value={taxEditor.confirmationNumber} onChange={(event) => setTaxEditor((current) => ({ ...current, confirmationNumber: event.target.value }))} />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="tax-notes">Notes</Label>
                            <Textarea id="tax-notes" rows={3} value={taxEditor.notes} onChange={(event) => setTaxEditor((current) => ({ ...current, notes: event.target.value }))} />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => openTaxActionConfirmation('filed')}>Mark as Filed</Button>
                          <Button onClick={() => openTaxActionConfirmation('paid')}>Mark as Paid</Button>
                          <Button variant="destructive" onClick={() => openTaxActionConfirmation('unfiled')}>Reset to Unfiled</Button>
                          <Button variant="secondary" onClick={() => openTaxActionConfirmation('save')}>Save Details</Button>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 md:p-6 border-border">
                      <div className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div>
                            <h3 className="text-lg font-bold">Filing History</h3>
                            <p className="text-sm text-muted-foreground">All recent filing periods and status.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(['all', 'unpaid', 'paid', 'overdue'] as const).map((filterValue) => (
                              <Button
                                key={filterValue}
                                size="sm"
                                variant={taxHistoryFilter === filterValue ? 'default' : 'outline'}
                                onClick={() => setTaxHistoryFilter(filterValue)}
                              >
                                {filterValue === 'all' ? 'All' : filterValue === 'unpaid' ? 'Unpaid' : filterValue === 'paid' ? 'Paid' : 'Overdue'}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {salesTaxHistoryPeriods
                            .filter((period) => {
                              const overdue = isSalesTaxPeriodOverdue(period)
                              if (taxHistoryFilter === 'paid') return period.status === 'paid'
                              if (taxHistoryFilter === 'unpaid') return period.status !== 'paid'
                              if (taxHistoryFilter === 'overdue') return overdue
                              return true
                            })
                            .map((period) => {
                              const overdue = isSalesTaxPeriodOverdue(period)
                              return (
                                <div key={period.periodKey} className="rounded-lg border border-border p-4">
                                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <p className="font-semibold">{period.periodLabel}</p>
                                        <Badge variant={getStatusBadgeVariant(period.status, overdue)}>{overdue ? 'Overdue' : period.status}</Badge>
                                      </div>
                                      <p className="text-sm text-muted-foreground">Due Date: {period.dueDate ? formatDateForDisplay(period.dueDate) : '—'}</p>
                                      <p className="text-sm text-muted-foreground">Filed Date: {period.filedAt ? formatDateForDisplay(period.filedAt) : '—'}</p>
                                      <p className="text-sm text-muted-foreground">Paid Date: {period.paidAt ? formatDateForDisplay(period.paidAt) : '—'}</p>
                                      <p className="text-sm text-muted-foreground">Confirmation Number: {period.confirmationNumber || '—'}</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm min-w-0">
                                      <div><p className="text-muted-foreground">Total Sales</p><p className="font-semibold">${period.totalSales.toFixed(2)}</p></div>
                                      <div><p className="text-muted-foreground">Taxable Sales</p><p className="font-semibold">${period.taxableSales.toFixed(2)}</p></div>
                                      <div><p className="text-muted-foreground">Tax Collected</p><p className="font-semibold">${period.taxCollected.toFixed(2)}</p></div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground">{SALES_TAX_DISCLAIMER}</p>
                      </div>
                    </Card>
                  </>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="disputes" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">OPEN</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">{disputeSummary.open}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">NEED RESPONSE</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5 text-amber-600">{disputeSummary.actionNeeded}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">WON</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5 text-emerald-600">{disputeSummary.won}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">LOST</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5 text-destructive">{disputeSummary.lost}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2 md:p-2.5 border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">DISPUTED AMOUNT</p>
                    <p className="text-lg md:text-xl font-bold mt-0.5">
                      ${disputeSummary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="border-border">
              <div className="p-4 md:p-6 border-b border-border">
                <div className="flex flex-col gap-4">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                        <Gavel size={20} weight="duotone" />
                        Disputes &amp; Chargebacks
                      </h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        View and respond to chargebacks and disputes. Stripe handles the dispute workflow — review evidence and track resolution status here.
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium cursor-pointer" onClick={() => toggleDisputeSort('respondBy')}>Respond by</th>
                      <th className="px-4 py-3 text-left font-medium cursor-pointer" onClick={() => toggleDisputeSort('disputedOn')}>Disputed on</th>
                      <th className="px-4 py-3 text-left font-medium cursor-pointer" onClick={() => toggleDisputeSort('status')}>Status</th>
                      <th className="px-4 py-3 text-left font-medium cursor-pointer" onClick={() => toggleDisputeSort('reason')}>Reason</th>
                      <th className="px-4 py-3 text-left font-medium cursor-pointer" onClick={() => toggleDisputeSort('from')}>From</th>
                      <th className="px-4 py-3 text-right font-medium cursor-pointer" onClick={() => toggleDisputeSort('amount')}>Disputed amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDisputes.map((entry) => {
                      const urgency = dueDateUrgency(entry)
                      return (
                        <tr
                          key={entry.id}
                          className="border-b border-border/70 cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={() => openDisputeDetails(entry)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              openDisputeDetails(entry)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                        >
                          <td className={`px-4 py-3 ${urgency === 'destructive' ? 'text-destructive font-semibold' : urgency === 'warning' ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                            {entry.responseDueAt ? formatDateForDisplay(entry.responseDueAt.slice(0, 10)) : '—'}
                          </td>
                          <td className="px-4 py-3">{formatDateForDisplay(entry.createdAt.slice(0, 10))}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 items-center">
                              <Badge variant={isDisputeActionNeeded(entry) ? 'destructive' : 'secondary'}>{entry.disputeStatus || entry.status}</Badge>
                              {isDisputeActionNeeded(entry) && <Badge variant="outline">Action needed</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3">{entry.disputeReasonLabel || humanizeDisputeReason(entry.disputeReason)}</td>
                          <td className="px-4 py-3">{entry.customerName || entry.clientName}</td>
                          <td className="px-4 py-3 text-right font-medium">${entry.grossAmount.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {filteredDisputes.length === 0 && (
                  <div className="p-10 text-center space-y-3">
                    <p className="text-lg font-semibold">No disputes found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting filters or search terms to find matching dispute activity.</p>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open)
          if (!open) {
            setSelectedPayment(null)
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
            <DialogDescription>
              Review payment, refund, or dispute details for this ledger activity.
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{selectedPayment.clientName}</h3>
                  {selectedPayment.serviceLabel && (
                    <p className="text-sm text-muted-foreground">{selectedPayment.serviceLabel}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs uppercase tracking-wider">
                  {selectedPayment.eventType}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDateForDisplay(selectedPayment.createdAt.slice(0, 10))}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
                  <p className="font-semibold">{selectedPayment.status}</p>
                </div>
                {(selectedPayment.eventType === 'payment' || selectedPayment.eventType === 'failed_payment') && (
                  <>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="font-semibold">${selectedPayment.grossAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Tip</p>
                      <p className="font-medium">${selectedPayment.tipAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Method</p>
                      <p className="font-medium">{selectedPayment.paymentMethodLabel || 'Unknown'}</p>
                    </div>
                    {selectedPayment.stripePaymentIntentId && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Stripe Payment Intent</p>
                        <p className="font-medium break-all">{selectedPayment.stripePaymentIntentId}</p>
                      </div>
                    )}
                    {selectedPayment.stripeChargeId && (
                      <div className="col-span-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Stripe Charge</p>
                        <p className="font-medium break-all">{selectedPayment.stripeChargeId}</p>
                      </div>
                    )}
                  </>
                )}
                {selectedPayment.eventType === 'refund' && (
                  <>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Refund Amount</p>
                      <p className="font-semibold">-${selectedPayment.grossAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Refund ID</p>
                      <p className="font-medium break-all">{selectedPayment.stripeRefundId}</p>
                    </div>
                    {selectedPayment.refundReason && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Refund Reason</p>
                        <p className="font-medium">{selectedPayment.refundReason}</p>
                      </div>
                    )}
                    {selectedPayment.linkedPaymentReference && (
                      <div className="col-span-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Linked Payment</p>
                        <p className="font-medium break-all">{selectedPayment.linkedPaymentReference}</p>
                      </div>
                    )}
                  </>
                )}
                {selectedPayment.eventType === 'dispute' && (
                  <>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Dispute Amount</p>
                      <p className="font-semibold">-${selectedPayment.grossAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Dispute Status</p>
                      <p className="font-medium">{selectedPayment.disputeStatus || selectedPayment.status}</p>
                    </div>
                    {selectedPayment.stripeDisputeId && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Dispute ID</p>
                        <p className="font-medium break-all">{selectedPayment.stripeDisputeId}</p>
                      </div>
                    )}
                    {selectedPayment.disputeReason && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Reason</p>
                        <p className="font-medium">{selectedPayment.disputeReason}</p>
                      </div>
                    )}
                    {selectedPayment.responseDueAt && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Evidence Due</p>
                        <p className="font-medium">{formatDateForDisplay(selectedPayment.responseDueAt.slice(0, 10))}</p>
                      </div>
                    )}
                    {(selectedPayment.stripePaymentIntentId || selectedPayment.stripeChargeId) && (
                      <div className="col-span-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Linked Stripe Reference</p>
                        <p className="font-medium break-all">
                          {selectedPayment.stripePaymentIntentId ?? selectedPayment.stripeChargeId}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              {selectedPayment.stripeDashboardUrl && (
                <a
                  href={selectedPayment.stripeDashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline"
                >
                  View Stripe Dashboard details
                </a>
              )}
              {selectedPayment.notes && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedPayment.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={disputeDetailsOpen} onOpenChange={setDisputeDetailsOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Dispute details</SheetTitle>
            <SheetDescription>Review Stripe dispute context and response requirements.</SheetDescription>
          </SheetHeader>
          {selectedDispute && (
            <div className="mt-6 space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={isDisputeActionNeeded(selectedDispute) ? 'destructive' : 'secondary'}>
                  {selectedDispute.disputeStatus || selectedDispute.status}
                </Badge>
                {isDisputeActionNeeded(selectedDispute) && <Badge variant="outline">Action needed</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Dispute ID</p><p className="font-medium break-all">{selectedDispute.stripeDisputeId || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{selectedDispute.customerName || selectedDispute.clientName}</p></div>
                <div><p className="text-xs text-muted-foreground">Amount</p><p className="font-medium">${selectedDispute.grossAmount.toFixed(2)} {selectedDispute.currency.toUpperCase()}</p></div>
                <div><p className="text-xs text-muted-foreground">Reason</p><p className="font-medium">{selectedDispute.disputeReasonLabel || humanizeDisputeReason(selectedDispute.disputeReason)}</p></div>
                <div><p className="text-xs text-muted-foreground">Disputed on</p><p className="font-medium">{formatDateForDisplay(selectedDispute.createdAt.slice(0, 10))}</p></div>
                <div><p className="text-xs text-muted-foreground">Evidence due</p><p className="font-medium">{selectedDispute.responseDueAt ? formatDateForDisplay(selectedDispute.responseDueAt.slice(0, 10)) : '—'}</p></div>
                <div className="col-span-2"><p className="text-xs text-muted-foreground">Payment intent</p><p className="font-medium break-all">{selectedDispute.stripePaymentIntentId || '—'}</p></div>
                <div className="col-span-2"><p className="text-xs text-muted-foreground">Charge</p><p className="font-medium break-all">{selectedDispute.stripeChargeId || '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Payment method</p><p className="font-medium">{selectedDispute.paymentMethodLabel || 'Card'} {selectedDispute.paymentMethodLast4 ? `•••• ${selectedDispute.paymentMethodLast4}` : ''}</p></div>
                <div><p className="text-xs text-muted-foreground">Service context</p><p className="font-medium">{selectedDispute.serviceLabel || '—'}</p></div>
              </div>
              {selectedDispute.stripeDashboardUrl && <a className="text-primary underline" target="_blank" rel="noreferrer" href={selectedDispute.stripeDashboardUrl}>Open in Stripe Dashboard</a>}
              <div className="space-y-2">
                <Label htmlFor="dispute-evidence-notes">Evidence notes</Label>
                <Textarea
                  id="dispute-evidence-notes"
                  value={evidenceNotes}
                  onChange={(event) => setEvidenceNotes(event.target.value)}
                  placeholder="Provide factual evidence details for Stripe review."
                  disabled={!canRespondToDisputes || !isDisputeActionNeeded(selectedDispute)}
                />
                {!canRespondToDisputes && <p className="text-xs text-muted-foreground">Only manager, owner, or admin roles can submit evidence.</p>}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={submitEvidence}
                  disabled={
                    !selectedDispute.stripeDisputeId ||
                    !canRespondToDisputes ||
                    !isDisputeActionNeeded(selectedDispute) ||
                    !evidenceNotes.trim() ||
                    submitDisputeEvidence.isPending
                  }
                >
                  {submitDisputeEvidence.isPending ? 'Submitting…' : 'Submit evidence'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={taxActionDialogOpen}
        onOpenChange={(open) => {
          setTaxActionDialogOpen(open)
          if (!open) {
            setPendingTaxAction(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingTaxActionConfig?.title ?? 'Confirm tax action'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingTaxActionConfig?.description ?? 'Please confirm this tax action before continuing.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={pendingTaxAction === 'unfiled' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
              onClick={() => {
                void handleConfirmTaxAction()
              }}
            >
              {pendingTaxActionConfig?.confirmLabel ?? 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
