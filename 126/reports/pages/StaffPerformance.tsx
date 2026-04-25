/**
 * Staff Performance Report - Production Ready
 * Individual and comparative staff performance metrics
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
import { ChartCard, SimpleBarChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DrillDrawer } from '../components/DrillDrawer'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { SaveViewDialog, ScheduleDialog, SavedViewsList } from '../components/SavedViewsManager'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData, useSavedViews, useReportSchedules } from '../hooks/useReportData'
import { generateInsights } from '../engine/insightsEngine'
import {
  calculateRevenuePerHour,
  calculateMarginPerHour,
  calculateStaffRebookRate,
  calculateUpsellRate,
  calculateStaffAvgTicket,
  calculateOnTimeStartPercent,
  calculateTipsPerHour,
  calculateKPIWithDelta,
  generateRevenueMarginByStaffChart,
  generateRebookRateByStaffChart,
  aggregateStaffPerformance,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, SavedView } from '../types'

export function StaffPerformance() {
  const navigate = useNavigate()
  const { filters, setFilters } = useReportFilters()
  const {
    appointments,
    previousAppointments,
    transactions,
    previousTransactions,
    staff,
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

  // Calculate KPIs (averages across all staff)
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateStaffKPIs', () => {
      const currentRevPerHour = calculateRevenuePerHour(appointments, staff)
      const previousRevPerHour = calculateRevenuePerHour(previousAppointments, staff)

      const currentMarginPerHour = calculateMarginPerHour(appointments, transactions, staff)
      const previousMarginPerHour = calculateMarginPerHour(previousAppointments, previousTransactions, staff)

      const currentRebook = calculateStaffRebookRate(appointments)
      const previousRebook = calculateStaffRebookRate(previousAppointments)

      const currentUpsell = calculateUpsellRate(appointments)
      const previousUpsell = calculateUpsellRate(previousAppointments)

      const currentAvgTicket = calculateStaffAvgTicket(appointments)
      const previousAvgTicket = calculateStaffAvgTicket(previousAppointments)

      const currentOnTime = calculateOnTimeStartPercent(appointments)
      const previousOnTime = calculateOnTimeStartPercent(previousAppointments)

      const currentTipsPerHour = calculateTipsPerHour(appointments, staff)
      const previousTipsPerHour = calculateTipsPerHour(previousAppointments, staff)

      return [
        { metricId: 'revenuePerHour', value: calculateKPIWithDelta(currentRevPerHour, previousRevPerHour, 'money') },
        { metricId: 'marginPerHour', value: calculateKPIWithDelta(currentMarginPerHour, previousMarginPerHour, 'money') },
        { metricId: 'staffRebookRate', value: calculateKPIWithDelta(currentRebook, previousRebook, 'percent') },
        { metricId: 'upsellRate', value: calculateKPIWithDelta(currentUpsell, previousUpsell, 'percent') },
        { metricId: 'staffAvgTicket', value: calculateKPIWithDelta(currentAvgTicket, previousAvgTicket, 'money') },
        { metricId: 'onTimeStartPercent', value: calculateKPIWithDelta(currentOnTime, previousOnTime, 'percent') },
        { metricId: 'tipsPerHour', value: calculateKPIWithDelta(currentTipsPerHour, previousTipsPerHour, 'money') },
      ]
    })
  }, [appointments, previousAppointments, transactions, previousTransactions, staff])

  // Generate insights
  const insights = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateStaffInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions,
        inventoryItems: [],
        messages: [],
        filters,
      }).filter(i => ['staff', 'performance', 'productivity', 'standout'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, previousTransactions, filters])

  // Chart data
  const revenueMarginByStaffData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateRevenueMarginByStaff', () =>
      generateRevenueMarginByStaffChart(appointments, transactions, staff)
    )
  }, [appointments, transactions, staff])

  const rebookRateByStaffData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateRebookByStaff', () =>
      generateRebookRateByStaffChart(appointments, staff)
    )
  }, [appointments, staff])

  // Table data
  const tableData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('aggregateStaffTable', () =>
      aggregateStaffPerformance(appointments, transactions, staff)
    )
  }, [appointments, transactions, staff])

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    const rows: DrillRow[] = appointments
      .filter(a => a.status === 'picked_up')
      .map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))

    const labels: Record<string, string> = {
      revenuePerHour: 'Revenue per Hour',
      marginPerHour: 'Margin per Hour',
      staffRebookRate: 'Rebook Rate',
      upsellRate: 'Upsell Rate',
      staffAvgTicket: 'Average Ticket',
      onTimeStartPercent: 'On-Time Starts',
      tipsPerHour: 'Tips per Hour',
    }

    setDrillTitle(`${labels[metricId] || metricId} Details`)
    setDrillSubtitle(`${rows.length} completed appointments`)
    setDrillRows(rows)
    setDrillTotal({ label: labels[metricId] || 'Value', value, format: metricId.includes('Rate') || metricId.includes('Percent') ? 'percent' : 'money' })
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
    const rows = getDrillRows(appointments, transactions, `staff:${dataPoint.label}`)
    setDrillTitle(dataPoint.label)
    setDrillSubtitle('Staff performance breakdown')
    setDrillRows(rows)
    setDrillTotal({ label: 'Value', value: dataPoint.value, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'staff-performance', filters, compareEnabled: compareMode })
  }, [saveView, filters, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  const handleExportCSV = useCallback(() => {
    const headers = ['Staff', 'Appts', 'Hours', 'Revenue', 'Margin', 'Tips', 'Duration Var', 'No-Show %', 'Rebook %', 'Avg Rating']
    const rows = tableData.map(row => [
      row.dimensionValue,
      row.metrics.appointments || 0,
      (row.metrics.hours || 0).toFixed(1),
      ((row.metrics.revenue || 0) / 100).toFixed(2),
      ((row.metrics.margin || 0) / 100).toFixed(2),
      ((row.metrics.tips || 0) / 100).toFixed(2),
      (row.metrics.durationVariance || 0).toFixed(1),
      (row.metrics.noShowRate || 0).toFixed(1),
      (row.metrics.rebookRate || 0).toFixed(1),
      (row.metrics.avgRating || 0).toFixed(1),
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `staff-performance-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = ['Date', 'Client', 'Service', 'Duration', 'Revenue', 'Tip', 'Rating']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown> & { services?: Array<{ name?: string }> }
      return [d.serviceDate || '', d.clientName || '', d.services?.[0]?.name || '', d.actualDurationMinutes || '', ((d.netCents || 0) / 100).toFixed(2), ((d.tipCents || 0) / 100).toFixed(2), d.rating || '']
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `staff-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`
  const formatPercent = (v: number) => `${v.toFixed(1)}%`

  // Loading
  if (isLoading) {
    return (
      <ReportShell title="Staff Performance" description="Individual performance metrics" defaultTimeBasis="checkout">
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
      <ReportShell title="Staff Performance" description="Individual performance metrics" defaultTimeBasis="checkout">
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
      <ReportShell title="Staff Performance" description="Individual performance metrics" defaultTimeBasis="checkout" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Performance Data</h2>
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
        title="Staff Performance"
        description="Individual and comparative staff performance metrics"
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
          <ChartCard title="Revenue & Margin per Hour" description="Productivity comparison across staff" ariaLabel="Bar chart of revenue and margin per hour by staff">
            <SimpleBarChart 
              data={revenueMarginByStaffData} 
              height={280} 
              formatValue={formatMoney}
              onClick={handleChartDrill}
              colorScheme="blue"
            />
          </ChartCard>

          <ChartCard title="Rebook Rate by Staff" description="Client retention performance by groomer" ariaLabel="Bar chart of rebook rates by staff">
            <SimpleBarChart 
              data={rebookRateByStaffData} 
              height={280} 
              formatValue={formatPercent}
              onClick={handleChartDrill}
              colorScheme="green"
            />
          </ChartCard>
        </div>

        {/* Data Table */}
        <DataTable
          title="Staff Rollup"
          data={tableData}
          columns={[
            { id: 'appointments', label: 'Appts', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'hours', label: 'Hours', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'margin', label: 'Margin', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tips', label: 'Tips', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'durationVariance', label: 'Duration Var', format: 'minutes', align: 'right', sortable: true },
            { id: 'noShowRate', label: 'No-Show %', format: 'percent', align: 'right', sortable: true },
            { id: 'rebookRate', label: 'Rebook %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgRating', label: 'Avg Rating', format: 'number', align: 'right', sortable: true },
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
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="staff-performance" filters={filters} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportCSV() } }} />
    </>
  )
}
