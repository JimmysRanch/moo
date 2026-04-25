/**
 * No-Shows & Cancellations Report - Production Ready
 * Track and analyze appointment failures to reduce lost revenue
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
import { ChartCard, SimpleHeatmap, SimpleBarChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DrillDrawer } from '../components/DrillDrawer'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { SaveViewDialog, ScheduleDialog, SavedViewsList } from '../components/SavedViewsManager'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData, useSavedViews, useReportSchedules } from '../hooks/useReportData'
import { generateInsights } from '../engine/insightsEngine'
import {
  calculateNoShowRate,
  calculateLateCancelRate,
  calculateLostRevenue,
  calculateRecoveryRate,
  calculateKPIWithDelta,
  generateNoShowHeatmap,
  generateRatesByReminderChart,
  aggregateNoShowsBySegment,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, SavedView } from '../types'

export function NoShowsCancellations() {
  const navigate = useNavigate()
  const { filters, setFilters } = useReportFilters()
  const {
    appointments,
    previousAppointments,
    transactions,
    messages,
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
  const [groupBy, setGroupBy] = useState<string>('service')
  const [compareMode, setCompareMode] = useState(false)

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateNoShowKPIs', () => {
      const currentNoShow = calculateNoShowRate(appointments)
      const previousNoShow = calculateNoShowRate(previousAppointments)

      const currentLateCancel = calculateLateCancelRate(appointments)
      const previousLateCancel = calculateLateCancelRate(previousAppointments)

      const currentLostRevenue = calculateLostRevenue(appointments)
      const previousLostRevenue = calculateLostRevenue(previousAppointments)

      const currentRecovery = calculateRecoveryRate(appointments)
      const previousRecovery = calculateRecoveryRate(previousAppointments)

      return [
        { metricId: 'noShowRate', value: calculateKPIWithDelta(currentNoShow, previousNoShow, 'percent') },
        { metricId: 'lateCancelRate', value: calculateKPIWithDelta(currentLateCancel, previousLateCancel, 'percent') },
        { metricId: 'lostRevenue', value: calculateKPIWithDelta(currentLostRevenue, previousLostRevenue, 'money') },
        { metricId: 'recoveryRate', value: calculateKPIWithDelta(currentRecovery, previousRecovery, 'percent') },
      ]
    })
  }, [appointments, previousAppointments])

  // Generate insights
  const insights = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateNoShowInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions: [],
        inventoryItems: [],
        messages,
        filters,
      }).filter(i => ['noshow', 'cancel', 'recovery', 'reminder'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, messages, filters])

  // Chart data
  const noShowHeatmapData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateNoShowHeatmap', () =>
      generateNoShowHeatmap(appointments)
    )
  }, [appointments])

  const ratesByReminderData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateRatesByReminder', () =>
      generateRatesByReminderChart(appointments, messages)
    )
  }, [appointments, messages])

  // Table data
  const tableData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('aggregateNoShowsTable', () =>
      aggregateNoShowsBySegment(appointments, messages, groupBy as string)
    )
  }, [appointments, messages, groupBy])

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    let rows: DrillRow[] = []
    let title = ''

    switch (metricId) {
      case 'noShowRate':
        rows = appointments.filter(a => a.status === 'no_show').map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'No-Show Appointments'
        break
      case 'lateCancelRate':
        rows = appointments.filter(a => a.status === 'cancelled' && a.cancelledWithin24h).map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Late Cancellations'
        break
      case 'lostRevenue':
        rows = appointments.filter(a => a.status === 'no_show' || a.status === 'cancelled').map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Lost Revenue Appointments'
        break
      case 'recoveryRate':
        rows = appointments.filter(a => (a.status === 'no_show' || a.status === 'cancelled') && a.rebookedWithin7d).map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Recovered Appointments'
        break
      default:
        rows = appointments.map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Appointments'
    }

    setDrillTitle(title)
    setDrillSubtitle(`${rows.length} appointments`)
    setDrillRows(rows)
    setDrillTotal({ label: title, value, format: metricId === 'lostRevenue' ? 'money' : 'percent' })
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
    setDrillTotal({ label: 'No-Show Rate', value: row.metrics.noShowRate || 0, format: 'percent' })
    setDrillOpen(true)
  }, [appointments, transactions])

  const handleHeatmapDrill = useCallback((cell: { weekday: string; hour: number; value: number }) => {
    const rows = appointments
      .filter(a => {
        const d = new Date(a.serviceDate)
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const h = parseInt(a.startTime?.split(':')[0] || '0')
        return weekdays[d.getDay()] === cell.weekday && h === cell.hour && a.status === 'no_show'
      })
      .map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))

    setDrillTitle(`No-shows: ${cell.weekday} at ${cell.hour}:00`)
    setDrillSubtitle(`${rows.length} no-show appointments`)
    setDrillRows(rows)
    setDrillTotal({ label: 'No-Shows', value: rows.length, format: 'number' })
    setDrillOpen(true)
  }, [appointments])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'noshows-cancellations', filters, groupBy, compareEnabled: compareMode })
  }, [saveView, filters, groupBy, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.groupBy) setGroupBy(view.groupBy)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  const handleExportCSV = useCallback(() => {
    const headers = ['Segment', 'Appts', 'No-Shows', 'Late Cancels', 'No-Show Rate', 'Late Cancel Rate', 'Avg Lead Time', 'Reminder Sent', 'Confirmed', 'Recovery Rate']
    const rows = tableData.map(row => [
      row.dimensionValue,
      row.metrics.appointments || 0,
      row.metrics.noShows || 0,
      row.metrics.lateCancels || 0,
      (row.metrics.noShowRate || 0).toFixed(1),
      (row.metrics.lateCancelRate || 0).toFixed(1),
      (row.metrics.avgLeadTime || 0).toFixed(1),
      row.metrics.reminderSent || 0,
      row.metrics.confirmed || 0,
      (row.metrics.recoveryRate || 0).toFixed(1),
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `noshows-cancellations-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = ['Date', 'Time', 'Client', 'Pet', 'Service', 'Status', 'Reminder Sent', 'Confirmed']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown> & { services?: Array<{ name?: string }> }
      return [d.serviceDate || '', d.startTime || '', d.clientName || '', d.petName || '', d.services?.[0]?.name || '', d.status || '', d.reminderSent ? 'Yes' : 'No', d.confirmed ? 'Yes' : 'No']
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `noshows-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  const formatPercent = (v: number) => `${v.toFixed(1)}%`

  // Loading
  if (isLoading) {
    return (
      <ReportShell title="No-Shows & Cancellations" description="Appointment failure tracking" defaultTimeBasis="service">
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
      <ReportShell title="No-Shows & Cancellations" description="Appointment failure tracking" defaultTimeBasis="service">
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
      <ReportShell title="No-Shows & Cancellations" description="Appointment failure tracking" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <p className="text-muted-foreground mb-4">No appointments found for the selected filters.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
        <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell
        title="No-Shows & Cancellations"
        description="Track and analyze appointment failures to reduce lost revenue"
        defaultTimeBasis="service"
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
          <ChartCard title="No-Show Heatmap" description="No-show frequency by day of week and hour" ariaLabel="Heatmap of no-shows by day and hour">
            <SimpleHeatmap 
              data={noShowHeatmapData} 
              height={220} 
              formatValue={(v) => `${v}`}
              onClick={handleHeatmapDrill}
              colorScheme="red"
            />
          </ChartCard>

          <ChartCard title="Rates by Reminder Timing" description="No-show rates based on reminder timing and channel" ariaLabel="Bar chart of rates by reminder timing">
            <SimpleBarChart 
              data={ratesByReminderData} 
              height={280} 
              formatValue={formatPercent}
              colorScheme="blue"
            />
          </ChartCard>
        </div>

        {/* Data Table */}
        <DataTable
          title="No-Show Analysis by Segment"
          data={tableData}
          groupByOptions={[
            { value: 'service', label: 'By Service' },
            { value: 'staff', label: 'By Staff' },
            { value: 'clientType', label: 'By Client Type' },
            { value: 'channel', label: 'By Channel' },
            { value: 'day', label: 'By Day' },
          ]}
          selectedGroupBy={groupBy}
          onGroupByChange={setGroupBy}
          columns={[
            { id: 'appointments', label: 'Appts', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'noShows', label: 'No-Shows', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'lateCancels', label: 'Late Cancels', format: 'number', align: 'right', sortable: true },
            { id: 'noShowRate', label: 'No-Show Rate', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'lateCancelRate', label: 'Late Cancel Rate', format: 'percent', align: 'right', sortable: true },
            { id: 'avgLeadTime', label: 'Avg Lead Time', format: 'number', align: 'right', sortable: true },
            { id: 'reminderSent', label: 'Reminder Sent', format: 'number', align: 'right', sortable: true },
            { id: 'confirmed', label: 'Confirmed', format: 'number', align: 'right', sortable: true },
            { id: 'recoveryRate', label: 'Recovery Rate', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
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
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="noshows-cancellations" filters={filters} groupBy={groupBy} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportCSV() } }} />
    </>
  )
}
