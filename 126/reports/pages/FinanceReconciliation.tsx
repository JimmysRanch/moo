/**
 * Finance & Reconciliation Report - Production Ready
 * Transaction-level financial tracking and reconciliation
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Warning, ArrowsClockwise, Info, Clock, Check, X } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { InsightsStrip, InsightsEmptyState } from '../components/InsightsStrip'
import { ChartCard, SimpleLineChart, SimpleBarChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DrillDrawer } from '../components/DrillDrawer'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { SaveViewDialog, ScheduleDialog, SavedViewsList } from '../components/SavedViewsManager'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData, useSavedViews, useReportSchedules } from '../hooks/useReportData'
import { generateInsights } from '../engine/insightsEngine'
import {
  calculateTotalCollectedTransaction,
  calculatePendingUnpaid,
  calculateTotalRefunds,
  calculateProcessingFees,
  calculateNetDeposits,
  calculateKPIWithDelta,
  generateCollectedByDayChart,
  generateRefundsByReasonChart,
  getTransactionsList,
  getAgingReceivables,
  getChargebacks,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, SavedView, TransactionRow } from '../types'

export function FinanceReconciliation() {
  const navigate = useNavigate()
  const { filters, setFilters } = useReportFilters()
  const {
    appointments,
    previousAppointments,
    transactions,
    previousTransactions,
    isLoading,
    error,
  } = useReportData(filters)
  const { savedViews, saveView, getView } = useSavedViews()
  const { createSchedule, markRun } = useReportSchedules()

  // UI State
  const [showDefinitions, setShowDefinitions] = useState(false)
  const [showSaveView, setShowSaveView] = useState(false)
  const [showSavedViews, setShowSavedViews] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillSubtitle, setDrillSubtitle] = useState<string | undefined>()
  const [drillRows, setDrillRows] = useState<DrillRow[]>([])
  const [drillTotal, setDrillTotal] = useState<{ label: string; value: number; format: 'money' | 'percent' | 'number' } | undefined>()
  const [activeTab, setActiveTab] = useState('transactions')
  const [compareMode, setCompareMode] = useState(false)

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (transactions.length === 0) return []

    return measurePerformance('calculateFinanceKPIs', () => {
      const currentCollected = calculateTotalCollectedTransaction(transactions)
      const previousCollected = calculateTotalCollectedTransaction(previousTransactions)

      const currentPending = calculatePendingUnpaid(appointments, transactions)
      const previousPending = calculatePendingUnpaid(previousAppointments, previousTransactions)

      const currentRefunds = calculateTotalRefunds(transactions)
      const previousRefunds = calculateTotalRefunds(previousTransactions)

      const currentFees = calculateProcessingFees(transactions)
      const previousFees = calculateProcessingFees(previousTransactions)

      const currentNetDeposits = calculateNetDeposits(transactions)
      const previousNetDeposits = calculateNetDeposits(previousTransactions)

      return [
        { metricId: 'totalCollectedTxn', value: calculateKPIWithDelta(currentCollected, previousCollected, 'money') },
        { metricId: 'pendingUnpaid', value: calculateKPIWithDelta(currentPending, previousPending, 'money') },
        { metricId: 'totalRefunds', value: calculateKPIWithDelta(currentRefunds, previousRefunds, 'money') },
        { metricId: 'processingFees', value: calculateKPIWithDelta(currentFees, previousFees, 'money') },
        { metricId: 'netDeposits', value: calculateKPIWithDelta(currentNetDeposits, previousNetDeposits, 'money') },
      ]
    })
  }, [appointments, previousAppointments, transactions, previousTransactions])

  // Generate insights
  const insights = useMemo(() => {
    if (transactions.length === 0) return []
    return measurePerformance('generateFinanceInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions,
        inventoryItems: [],
        messages: [],
        filters,
      }).filter(i => ['finance', 'payment', 'refund', 'fee'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, previousTransactions, filters])

  // Chart data
  const collectedByDayData = useMemo(() => {
    if (transactions.length === 0) return []
    return measurePerformance('generateCollectedByDay', () =>
      generateCollectedByDayChart(transactions)
    )
  }, [transactions])

  const previousCollectedData = useMemo(() => {
    if (!compareMode || previousTransactions.length === 0) return undefined
    return generateCollectedByDayChart(previousTransactions)
  }, [compareMode, previousTransactions])

  const refundsByReasonData = useMemo(() => {
    if (transactions.length === 0) return []
    return measurePerformance('generateRefundsByReason', () =>
      generateRefundsByReasonChart(transactions)
    )
  }, [transactions])

  // Table data
  const transactionsList = useMemo(() => {
    if (transactions.length === 0) return []
    return measurePerformance('getTransactionsList', () =>
      getTransactionsList(transactions)
    )
  }, [transactions])

  const agingReceivables = useMemo(() => {
    return measurePerformance('getAgingReceivables', () =>
      getAgingReceivables(appointments, transactions)
    )
  }, [appointments, transactions])

  const chargebacks = useMemo(() => {
    return measurePerformance('getChargebacks', () =>
      getChargebacks(transactions)
    )
  }, [transactions])

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    let rows: DrillRow[] = []
    let title = ''

    switch (metricId) {
      case 'totalCollectedTxn':
        rows = transactions
          .filter(t => t.status === 'settled')
          .map(t => ({ id: t.id, type: 'transaction' as const, data: t, timestamp: t.date }))
        title = 'Collected Transactions'
        break
      case 'pendingUnpaid':
        rows = appointments
          .filter(a => !transactions.some(t => t.appointmentId === a.id && t.status === 'settled'))
          .map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Pending/Unpaid'
        break
      case 'totalRefunds':
        rows = transactions
          .filter(t => t.type === 'refund')
          .map(t => ({ id: t.id, type: 'transaction' as const, data: t, timestamp: t.date }))
        title = 'Refunds'
        break
      case 'processingFees':
        rows = transactions
          .filter(t => t.feeCents > 0)
          .map(t => ({ id: t.id, type: 'transaction' as const, data: t, timestamp: t.date }))
        title = 'Processing Fees'
        break
      case 'netDeposits':
        rows = transactions
          .filter(t => t.status === 'settled')
          .map(t => ({ id: t.id, type: 'transaction' as const, data: t, timestamp: t.date }))
        title = 'Net Deposits'
        break
      default:
        rows = transactions.map(t => ({ id: t.id, type: 'transaction' as const, data: t, timestamp: t.date }))
        title = 'Transactions'
    }

    setDrillTitle(title)
    setDrillSubtitle(`${rows.length} items`)
    setDrillRows(rows)
    setDrillTotal({ label: title, value, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])

  const handleInsightClick = useCallback((insight: Insight) => {
    if (insight.drillKey) {
      const rows = getDrillRows(appointments, transactions, insight.drillKey)
      setDrillTitle(insight.title)
      setDrillSubtitle(insight.description)
      setDrillRows(rows)
      setDrillTotal(undefined)
      setDrillOpen(true)
    }
  }, [appointments, transactions])

  const handleTransactionClick = useCallback((row: TransactionRow) => {
    const txn = transactions.find(t => t.id === row.id)
    if (txn) {
      setDrillTitle(`Transaction ${txn.id.slice(0, 8)}...`)
      setDrillSubtitle(`${txn.method} • ${txn.status}`)
      setDrillRows([{ id: txn.id, type: 'transaction', data: txn, timestamp: txn.date }])
      setDrillTotal({ label: 'Amount', value: txn.amountCents, format: 'money' })
      setDrillOpen(true)
    }
  }, [transactions])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'finance-reconciliation', filters, groupBy: activeTab, compareEnabled: compareMode })
  }, [saveView, filters, activeTab, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.groupBy) setActiveTab(view.groupBy)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  const handleExportCSV = useCallback(() => {
    const headers = ['Date', 'Txn ID', 'Method', 'Collected', 'Fee', 'Net to Bank', 'Batch ID', 'Status']
    const rows = transactionsList.map(row => [
      row.date,
      row.id,
      row.method,
      (row.collectedCents / 100).toFixed(2),
      (row.feeCents / 100).toFixed(2),
      (row.netCents / 100).toFixed(2),
      row.batchId || '',
      row.status,
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `finance-reconciliation-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [transactionsList])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = ['Date', 'Type', 'Amount', 'Fee', 'Status']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown>
      return [d.date || d.serviceDate || '', r.type, ((d.amountCents || d.totalCents || 0) / 100).toFixed(2), ((d.feeCents || 0) / 100).toFixed(2), d.status || '']
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `finance-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`

  const _getStatusBadge = (status: string) => {
    switch (status) {
      case 'settled':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><Check className="w-3 h-3 mr-1" />Settled</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><X className="w-3 h-3 mr-1" />Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Loading
  if (isLoading) {
    return (
      <ReportShell title="Finance & Reconciliation" description="Transaction tracking" defaultTimeBasis="transaction">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-3"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-24" /></Card>
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[300px]" />
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </ReportShell>
    )
  }

  // Error
  if (error) {
    return (
      <ReportShell title="Finance & Reconciliation" description="Transaction tracking" defaultTimeBasis="transaction">
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertDescription>Failed to load financial data.</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} className="mt-4">
          <ArrowsClockwise className="mr-2 h-4 w-4" /> Retry
        </Button>
      </ReportShell>
    )
  }

  // Empty
  if (transactions.length === 0) {
    return (
      <ReportShell title="Finance & Reconciliation" description="Transaction tracking" defaultTimeBasis="transaction" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Transactions</h2>
          <p className="text-muted-foreground mb-4">No transactions found for the selected filters.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
        <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell
        title="Finance & Reconciliation"
        description="Transaction-level financial tracking and reconciliation"
        defaultTimeBasis="transaction"
        onSaveView={() => setShowSaveView(true)}
        onSchedule={() => setShowSchedule(true)}
        onExport={handleExportCSV}
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        {/* KPI Deck */}
        <KPIDeck metrics={kpis.map(kpi => ({ ...kpi, onClick: () => handleKPIDrill(kpi.metricId, kpi.value.current) }))} />

        {/* Insights */}
        {insights.length > 0 ? (
          <InsightsStrip insights={insights} onInsightClick={handleInsightClick} />
        ) : (
          <InsightsEmptyState />
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Collected by Day" description="Daily collection trend" ariaLabel="Line chart of daily collections">
            <SimpleLineChart 
              data={collectedByDayData} 
              previousData={compareMode ? previousCollectedData : undefined}
              height={280} 
              formatValue={formatMoney} 
              showArea 
            />
          </ChartCard>

          <ChartCard title="Refunds by Reason" description="Refund breakdown by reason" ariaLabel="Bar chart of refunds by reason">
            <SimpleBarChart 
              data={refundsByReasonData} 
              height={280} 
              formatValue={formatMoney}
              colorScheme="red"
            />
          </ChartCard>
        </div>

        {/* Tabbed Views */}
        <Card className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="aging">Aging Receivables</TabsTrigger>
              <TabsTrigger value="chargebacks">Chargebacks</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions">
              <DataTable
                title="Transaction List"
                data={transactionsList.map(t => ({
                  dimensionValue: t.id.slice(0, 8) + '...',
                  drillKey: `txn:${t.id}`,
                  matchingIds: [t.id],
                  metrics: {
                    date: t.date,
                    method: t.method,
                    collectedCents: t.collectedCents,
                    feeCents: t.feeCents,
                    netCents: t.netCents,
                    batchId: t.batchId,
                    status: t.status,
                  }
                }))}
                columns={[
                  { id: 'date', label: 'Date', format: 'text', align: 'left', defaultVisible: true, sortable: true },
                  { id: 'method', label: 'Method', format: 'text', align: 'left', defaultVisible: true, sortable: true },
                  { id: 'collectedCents', label: 'Collected', format: 'money', align: 'right', defaultVisible: true, sortable: true },
                  { id: 'feeCents', label: 'Fee', format: 'money', align: 'right', defaultVisible: true, sortable: true },
                  { id: 'netCents', label: 'Net to Bank', format: 'money', align: 'right', defaultVisible: true, sortable: true },
                  { id: 'batchId', label: 'Batch/Deposit ID', format: 'text', align: 'left', sortable: true },
                  { id: 'status', label: 'Status', format: 'badge', align: 'center', defaultVisible: true, sortable: true },
                ]}
                onRowClick={(row) => handleTransactionClick(transactionsList.find(t => t.id.startsWith(row.dimensionValue.replace('...', '')))!)}
                onExport={handleExportCSV}
                maxPreviewRows={10}
                showViewAll
              />
            </TabsContent>

            <TabsContent value="aging">
              {agingReceivables.length > 0 ? (
                <DataTable
                  title="Aging Receivables"
                  data={agingReceivables.map(a => ({
                    dimensionValue: a.clientName,
                    drillKey: `client:${a.clientId}`,
                    matchingIds: a.appointmentIds,
                    metrics: {
                      amountDue: a.amountDueCents,
                      daysPastDue: a.daysPastDue,
                      lastContact: a.lastContactDate,
                    }
                  }))}
                  columns={[
                    { id: 'amountDue', label: 'Amount Due', format: 'money', align: 'right', defaultVisible: true, sortable: true },
                    { id: 'daysPastDue', label: 'Days Past Due', format: 'number', align: 'right', defaultVisible: true, sortable: true },
                    { id: 'lastContact', label: 'Last Contact', format: 'text', align: 'left', sortable: true },
                  ]}
                  onRowClick={(row) => {
                    const ar = agingReceivables.find(a => a.clientName === row.dimensionValue)
                    if (ar) {
                      setDrillTitle(`${ar.clientName} - Outstanding`)
                      setDrillSubtitle(`${ar.daysPastDue} days past due`)
                      setDrillRows(ar.appointmentIds.map(id => {
                        const appt = appointments.find(a => a.id === id)
                        return { id, type: 'appointment' as const, data: appt || {}, timestamp: appt?.serviceDate || '' }
                      }))
                      setDrillTotal({ label: 'Amount Due', value: ar.amountDueCents, format: 'money' })
                      setDrillOpen(true)
                    }
                  }}
                  maxPreviewRows={5}
                  showViewAll
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Check size={32} className="mx-auto mb-2 text-green-500" />
                  <p>No outstanding receivables</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="chargebacks">
              {chargebacks.length > 0 ? (
                <DataTable
                  title="Chargebacks"
                  data={chargebacks.map(cb => ({
                    dimensionValue: cb.transactionId.slice(0, 8) + '...',
                    drillKey: `txn:${cb.transactionId}`,
                    matchingIds: [cb.transactionId],
                    metrics: {
                      date: cb.date,
                      amount: cb.amountCents,
                      reason: cb.reason,
                      status: cb.status,
                    }
                  }))}
                  columns={[
                    { id: 'date', label: 'Date', format: 'text', align: 'left', defaultVisible: true, sortable: true },
                    { id: 'amount', label: 'Amount', format: 'money', align: 'right', defaultVisible: true, sortable: true },
                    { id: 'reason', label: 'Reason', format: 'text', align: 'left', defaultVisible: true, sortable: true },
                    { id: 'status', label: 'Status', format: 'badge', align: 'center', defaultVisible: true, sortable: true },
                  ]}
                  maxPreviewRows={5}
                  showViewAll
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Check size={32} className="mx-auto mb-2 text-green-500" />
                  <p>No chargebacks</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </ReportShell>

      <DrillDrawer
        open={drillOpen}
        onClose={() => { setDrillOpen(false); setDrillRows([]); setDrillTotal(undefined) }}
        title={drillTitle}
        subtitle={drillSubtitle}
        totalValue={drillTotal}
        rows={drillRows}
        onExportCSV={handleExportDrillCSV}
        onOpenAppointment={(id) => navigate(`/appointments/${id}/edit`)}
        onOpenClient={(id) => navigate(`/clients/${id}`)}
      />

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="finance-reconciliation" filters={filters} groupBy={activeTab} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportCSV() } }} />
    </>
  )
}
