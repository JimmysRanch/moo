/**
 * Sales Summary Report - Production Ready
 * Comprehensive sales breakdown with multiple grouping options
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
import { ChartCard, SimpleLineChart, SimpleStackedBarChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DrillDrawer } from '../components/DrillDrawer'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { SaveViewDialog, ScheduleDialog, SavedViewsList } from '../components/SavedViewsManager'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData, useSavedViews, useReportSchedules } from '../hooks/useReportData'
import { generateInsights } from '../engine/insightsEngine'
import {
  calculateGrossSales,
  calculateNetSales,
  calculateTotalDiscounts,
  calculateTotalRefunds,
  calculateTotalTax,
  calculateTotalTips,
  calculateTotalCollected,
  calculateKPIWithDelta,
  generateSalesByDayChart,
  generateSalesByCategoryStackChart,
  aggregateByDimension,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, SavedView } from '../types'

export function SalesSummary() {
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
  const [groupBy, setGroupBy] = useState<string>('day')
  const [compareMode, setCompareMode] = useState(false)

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateSalesSummaryKPIs', () => {
      const currentGross = calculateGrossSales(appointments)
      const previousGross = calculateGrossSales(previousAppointments)

      const currentNet = calculateNetSales(appointments, filters.includeDiscounts, filters.includeRefunds)
      const previousNet = calculateNetSales(previousAppointments, filters.includeDiscounts, filters.includeRefunds)

      const currentDiscounts = calculateTotalDiscounts(appointments)
      const previousDiscounts = calculateTotalDiscounts(previousAppointments)

      const currentRefunds = calculateTotalRefunds(transactions)
      const previousRefunds = calculateTotalRefunds(previousTransactions)

      const currentTax = calculateTotalTax(appointments)
      const previousTax = calculateTotalTax(previousAppointments)

      const currentTips = calculateTotalTips(appointments)
      const previousTips = calculateTotalTips(previousAppointments)

      const currentTotal = calculateTotalCollected(appointments, transactions, filters)
      const previousTotal = calculateTotalCollected(previousAppointments, previousTransactions, filters)

      return [
        { metricId: 'grossSales', value: calculateKPIWithDelta(currentGross, previousGross, 'money') },
        { metricId: 'netSalesExTaxTips', value: calculateKPIWithDelta(currentNet, previousNet, 'money') },
        { metricId: 'totalDiscounts', value: calculateKPIWithDelta(currentDiscounts, previousDiscounts, 'money') },
        { metricId: 'totalRefunds', value: calculateKPIWithDelta(currentRefunds, previousRefunds, 'money') },
        { metricId: 'taxCollected', value: calculateKPIWithDelta(currentTax, previousTax, 'money') },
        { metricId: 'totalTips', value: calculateKPIWithDelta(currentTips, previousTips, 'money') },
        { metricId: 'totalCollected', value: calculateKPIWithDelta(currentTotal, previousTotal, 'money') },
      ]
    })
  }, [appointments, previousAppointments, transactions, previousTransactions, filters])

  // Generate insights
  const insights = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateSalesInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions,
        inventoryItems: [],
        messages: [],
        filters,
      }).filter(i => ['sales', 'revenue', 'discount'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, previousTransactions, filters])

  // Chart data
  const salesByDayData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateSalesByDay', () =>
      generateSalesByDayChart(appointments, filters)
    )
  }, [appointments, filters])

  const previousSalesByDayData = useMemo(() => {
    if (!compareMode || previousAppointments.length === 0) return undefined
    return generateSalesByDayChart(previousAppointments, { ...filters, dateRange: 'custom' })
  }, [compareMode, previousAppointments, filters])

  const salesByCategoryData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateSalesByCategory', () =>
      generateSalesByCategoryStackChart(appointments)
    )
  }, [appointments])

  // Table data
  const tableData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('aggregateSalesTable', () => {
      const rows = aggregateByDimension(appointments, groupBy as 'service' | 'staff' | 'day' | 'week' | 'month' | 'channel' | 'clientType' | 'paymentMethod')
      // Calculate invoice count per row
      return rows.map(row => ({
        ...row,
        metrics: {
          ...row.metrics,
          invoices: row.matchingIds.length,
        }
      }))
    })
  }, [appointments, groupBy])

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    let rows: DrillRow[] = []
    
    if (metricId === 'totalRefunds') {
      rows = transactions
        .filter(t => t.type === 'refund')
        .map(t => ({ id: t.id, type: 'transaction' as const, data: t, timestamp: t.date }))
    } else {
      rows = appointments
        .filter(a => a.status === 'picked_up')
        .map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
    }

    const labels: Record<string, string> = {
      grossSales: 'Gross Sales',
      netSalesExTaxTips: 'Net Sales',
      totalDiscounts: 'Discounts',
      totalRefunds: 'Refunds',
      taxCollected: 'Taxes',
      totalTips: 'Tips',
      totalCollected: 'Total Collected',
    }

    setDrillTitle(`${labels[metricId] || metricId} Details`)
    setDrillSubtitle(`${rows.length} ${metricId === 'totalRefunds' ? 'transactions' : 'appointments'}`)
    setDrillRows(rows)
    setDrillTotal({ label: labels[metricId] || 'Value', value, format: 'money' })
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

  const handleRowDrill = useCallback((row: AggregatedRow) => {
    const rows = getDrillRows(appointments, transactions, row.drillKey)
    setDrillTitle(row.dimensionValue)
    setDrillSubtitle(`${rows.length} items`)
    setDrillRows(rows)
    setDrillTotal({ label: 'Net Sales', value: row.metrics.netSales, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'sales-summary', filters, groupBy, compareEnabled: compareMode })
  }, [saveView, filters, groupBy, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.groupBy) setGroupBy(view.groupBy)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  const handleExportCSV = useCallback(() => {
    const headers = ['Dimension', 'Gross', 'Discounts', 'Refunds', 'Net', 'Tax', 'Tips', 'Invoices', 'Avg Ticket']
    const rows = tableData.map(row => [
      row.dimensionValue,
      (row.metrics.grossSales / 100).toFixed(2),
      (row.metrics.discounts / 100).toFixed(2),
      ((row.metrics.refunds || 0) / 100).toFixed(2),
      (row.metrics.netSales / 100).toFixed(2),
      (row.metrics.tax / 100).toFixed(2),
      (row.metrics.tips / 100).toFixed(2),
      row.metrics.invoices || row.metrics.appointments,
      (row.metrics.avgTicket / 100).toFixed(2),
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sales-summary-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = ['Date', 'Type', 'Client', 'Amount', 'Status']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown>
      return [
        d.serviceDate || d.date || '',
        r.type,
        d.clientName || '',
        ((d.netCents || d.amountCents || d.totalCents || 0) / 100).toFixed(2),
        d.status || '',
      ]
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sales-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`

  // Loading
  if (isLoading) {
    return (
      <ReportShell title="Sales Summary" description="Revenue breakdown and analysis" defaultTimeBasis="checkout">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
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
      <ReportShell title="Sales Summary" description="Revenue breakdown and analysis" defaultTimeBasis="checkout">
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertDescription>Failed to load report data.</AlertDescription>
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
      <ReportShell title="Sales Summary" description="Revenue breakdown and analysis" defaultTimeBasis="checkout" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Sales Data</h2>
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
        title="Sales Summary"
        description="Comprehensive revenue breakdown and analysis"
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
          <ChartCard title="Sales by Day" description="Daily revenue trend" ariaLabel="Line chart of daily sales">
            <SimpleLineChart 
              data={salesByDayData} 
              previousData={compareMode ? previousSalesByDayData : undefined}
              height={280} 
              formatValue={formatMoney} 
              showArea 
            />
          </ChartCard>

          <ChartCard title="Sales by Category" description="Revenue distribution by service category" ariaLabel="Stacked bar chart by category">
            <SimpleStackedBarChart 
              data={salesByCategoryData} 
              height={280} 
              formatValue={formatMoney}
            />
          </ChartCard>
        </div>

        {/* Data Table */}
        <DataTable
          title="Sales Breakdown"
          data={tableData}
          groupByOptions={[
            { value: 'day', label: 'By Day' },
            { value: 'week', label: 'By Week' },
            { value: 'month', label: 'By Month' },
            { value: 'staff', label: 'By Staff' },
            { value: 'service', label: 'By Service' },
            { value: 'serviceCategory', label: 'By Category' },
            { value: 'clientType', label: 'By Client Type' },
            { value: 'channel', label: 'By Channel' },
            { value: 'paymentMethod', label: 'By Payment Method' },
            { value: 'location', label: 'By Location' },
          ]}
          selectedGroupBy={groupBy}
          onGroupByChange={setGroupBy}
          columns={[
            { id: 'grossSales', label: 'Gross', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'discounts', label: 'Discounts', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'refunds', label: 'Refunds', format: 'money', align: 'right', sortable: true },
            { id: 'netSales', label: 'Net', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tax', label: 'Tax', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tips', label: 'Tips', format: 'money', align: 'right', sortable: true },
            { id: 'invoices', label: 'Invoices', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', defaultVisible: true, sortable: true },
          ]}
          onRowClick={handleRowDrill}
          onExport={handleExportCSV}
          maxPreviewRows={5}
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
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="sales-summary" filters={filters} groupBy={groupBy} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportCSV() } }} />
    </>
  )
}
