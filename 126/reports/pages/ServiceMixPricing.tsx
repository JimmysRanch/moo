/**
 * Service Mix & Pricing Performance Report - Production Ready
 * Service-level performance and pricing analysis
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Warning, ArrowsClockwise, Info } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { InsightsStrip, InsightsEmptyState } from '../components/InsightsStrip'
import { ChartCard, SimpleBarChart, SimpleScatterChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DrillDrawer } from '../components/DrillDrawer'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { SaveViewDialog, ScheduleDialog, SavedViewsList } from '../components/SavedViewsManager'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData, useSavedViews, useReportSchedules } from '../hooks/useReportData'
import { generateInsights } from '../engine/insightsEngine'
import {
  calculateTopServiceRevenue,
  calculateTopServiceMargin,
  calculateAttachUpsellRate,
  calculateAvgDurationVariance,
  calculateKPIWithDelta,
  generateRevenueVsMarginByServiceChart,
  generateDiscountVsMarginScatter,
  aggregateServiceMetrics,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, SavedView } from '../types'

export function ServiceMixPricing() {
  const navigate = useNavigate()
  const { filters, setFilters } = useReportFilters()
  const {
    appointments,
    previousAppointments,
    transactions,
    previousTransactions,
    inventoryItems,
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
  const [compareMode, setCompareMode] = useState(false)

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateServiceMixKPIs', () => {
      const currentTopRevenue = calculateTopServiceRevenue(appointments)
      const previousTopRevenue = calculateTopServiceRevenue(previousAppointments)

      const currentTopMargin = calculateTopServiceMargin(appointments, transactions, inventoryItems)
      const previousTopMargin = calculateTopServiceMargin(previousAppointments, previousTransactions, inventoryItems)

      const currentAttachRate = calculateAttachUpsellRate(appointments)
      const previousAttachRate = calculateAttachUpsellRate(previousAppointments)

      const currentDurationVar = calculateAvgDurationVariance(appointments)
      const previousDurationVar = calculateAvgDurationVariance(previousAppointments)

      return [
        { metricId: 'topServiceRevenue', value: calculateKPIWithDelta(currentTopRevenue.value, previousTopRevenue.value, 'money'), metadata: { serviceName: currentTopRevenue.name } },
        { metricId: 'topServiceMargin', value: calculateKPIWithDelta(currentTopMargin.value, previousTopMargin.value, 'money'), metadata: { serviceName: currentTopMargin.name } },
        { metricId: 'attachUpsellRate', value: calculateKPIWithDelta(currentAttachRate, previousAttachRate, 'percent') },
        { metricId: 'avgDurationVariance', value: calculateKPIWithDelta(currentDurationVar, previousDurationVar, 'number') },
      ]
    })
  }, [appointments, previousAppointments, transactions, previousTransactions, inventoryItems])

  // Generate insights
  const insights = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateServiceMixInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions,
        inventoryItems,
        messages: [],
        filters,
      }).filter(i => ['service', 'pricing', 'discount', 'upsell', 'attach'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, previousTransactions, inventoryItems, filters])

  // Chart data
  const revenueVsMarginData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateRevenueVsMargin', () =>
      generateRevenueVsMarginByServiceChart(appointments, transactions, inventoryItems)
    )
  }, [appointments, transactions, inventoryItems])

  const discountVsMarginData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateDiscountVsMargin', () =>
      generateDiscountVsMarginScatter(appointments, transactions, inventoryItems)
    )
  }, [appointments, transactions, inventoryItems])

  // Table data
  const tableData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('aggregateServiceTable', () =>
      aggregateServiceMetrics(appointments, transactions, inventoryItems)
    )
  }, [appointments, transactions, inventoryItems])

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    const rows: DrillRow[] = appointments
      .filter(a => a.status === 'picked_up')
      .map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))

    const labels: Record<string, string> = {
      topServiceRevenue: 'Top Service Revenue',
      topServiceMargin: 'Top Service Margin',
      attachUpsellRate: 'Attach/Upsell Rate',
      avgDurationVariance: 'Duration Variance',
    }

    setDrillTitle(`${labels[metricId] || metricId} Details`)
    setDrillSubtitle(`${rows.length} completed appointments`)
    setDrillRows(rows)
    setDrillTotal({ label: labels[metricId] || 'Value', value, format: metricId.includes('Rate') ? 'percent' : metricId.includes('Duration') ? 'number' : 'money' })
    setDrillOpen(true)
  }, [appointments])

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

  const handleRowDrill = useCallback((row: AggregatedRow) => {
    const rows = getDrillRows(appointments, transactions, row.drillKey)
    setDrillTitle(row.dimensionValue)
    setDrillSubtitle(`${rows.length} appointments`)
    setDrillRows(rows)
    setDrillTotal({ label: 'Revenue', value: row.metrics.revenue || row.metrics.netSales, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])

  const handleChartDrill = useCallback((dataPoint: { label: string; value: number }) => {
    const rows = getDrillRows(appointments, transactions, `service:${dataPoint.label}`)
    setDrillTitle(dataPoint.label)
    setDrillSubtitle('Service breakdown')
    setDrillRows(rows)
    setDrillTotal({ label: 'Value', value: dataPoint.value, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'service-mix-pricing', filters, compareEnabled: compareMode })
  }, [saveView, filters, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  const handleExportCSV = useCallback(() => {
    const headers = ['Service', 'Revenue', 'Appts', 'Avg Ticket', 'Discount %', 'Duration', 'Variance', 'COGS', 'Margin $', 'Margin %', 'No-Show %', 'Rebook %']
    const rows = tableData.map(row => [
      row.dimensionValue,
      ((row.metrics.revenue || 0) / 100).toFixed(2),
      row.metrics.appointments || 0,
      ((row.metrics.avgTicket || 0) / 100).toFixed(2),
      (row.metrics.discountPercent || 0).toFixed(1),
      (row.metrics.avgDuration || 0).toFixed(0),
      (row.metrics.durationVariance || 0).toFixed(1),
      ((row.metrics.cogs || 0) / 100).toFixed(2),
      ((row.metrics.margin || 0) / 100).toFixed(2),
      (row.metrics.marginPercent || 0).toFixed(1),
      (row.metrics.noShowRate || 0).toFixed(1),
      (row.metrics.rebookRate || 0).toFixed(1),
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `service-mix-pricing-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = ['Date', 'Client', 'Service', 'Revenue', 'Discount', 'Duration']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown> & { services?: Array<{ name?: string }> }
      return [d.serviceDate || '', d.clientName || '', d.services?.[0]?.name || '', ((d.netCents || 0) / 100).toFixed(2), ((d.discountCents || 0) / 100).toFixed(2), d.actualDurationMinutes || '']
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `service-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`
  const formatPercent = (v: number) => `${v.toFixed(1)}%`

  // Loading
  if (isLoading) {
    return (
      <ReportShell title="Service Mix & Pricing" description="Service performance analysis" defaultTimeBasis="checkout">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
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
      <ReportShell title="Service Mix & Pricing" description="Service performance analysis" defaultTimeBasis="checkout">
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertDescription>Failed to load data.</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} className="mt-4">
          <ArrowsClockwise className="mr-2 h-4 w-4" /> Retry
        </Button>
      </ReportShell>
    )
  }

  // Empty
  if (appointments.length === 0) {
    return (
      <ReportShell title="Service Mix & Pricing" description="Service performance analysis" defaultTimeBasis="checkout" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Service Data</h2>
          <p className="text-muted-foreground mb-4">No completed appointments found for the selected filters.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
        <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell
        title="Service Mix & Pricing Performance"
        description="Service-level performance and pricing analysis"
        defaultTimeBasis="checkout"
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
          <ChartCard title="Revenue vs Margin by Service" description="Compare revenue and margin performance" ariaLabel="Bar chart of revenue and margin by service">
            <SimpleBarChart 
              data={revenueVsMarginData} 
              height={280} 
              formatValue={formatMoney}
              onClick={handleChartDrill}
              colorScheme="blue"
            />
          </ChartCard>

          <ChartCard title="Discount % vs Margin %" description="Scatter plot showing discount impact on margins" ariaLabel="Scatter chart of discount vs margin">
            <SimpleScatterChart 
              data={discountVsMarginData} 
              height={280} 
              formatX={formatPercent}
              formatY={formatPercent}
              xLabel="Discount %"
              yLabel="Margin %"
            />
          </ChartCard>
        </div>

        {/* Data Table */}
        <DataTable
          title="Service Metrics"
          data={tableData}
          columns={[
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'appointments', label: 'Appts', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'discountPercent', label: 'Discount %', format: 'percent', align: 'right', sortable: true },
            { id: 'avgDuration', label: 'Duration', format: 'minutes', align: 'right', sortable: true },
            { id: 'durationVariance', label: 'Variance', format: 'minutes', align: 'right', sortable: true },
            { id: 'cogs', label: 'COGS', format: 'money', align: 'right', sortable: true },
            { id: 'margin', label: 'Margin $', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'marginPercent', label: 'Margin %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'noShowRate', label: 'No-Show %', format: 'percent', align: 'right', sortable: true },
            { id: 'rebookRate', label: 'Rebook %', format: 'percent', align: 'right', sortable: true },
          ]}
          onRowClick={handleRowDrill}
          onExport={handleExportCSV}
          maxPreviewRows={10}
          showViewAll
        />
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
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="service-mix-pricing" filters={filters} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportCSV() } }} />
    </>
  )
}
