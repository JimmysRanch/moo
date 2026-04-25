/**
 * Appointments & Capacity Report - Production Ready
 * Scheduling efficiency and capacity utilization tracking
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
import { ChartCard, SimpleBarChart, SimpleLineChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DrillDrawer } from '../components/DrillDrawer'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { SaveViewDialog, ScheduleDialog, SavedViewsList } from '../components/SavedViewsManager'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData, useSavedViews, useReportSchedules } from '../hooks/useReportData'
import { generateInsights } from '../engine/insightsEngine'
import {
  calculateBookedAppointments,
  calculateAppointmentsCompleted,
  calculateCancelledAppointments,
  calculateNoShowRate,
  calculateAvgLeadTime,
  calculateUtilization,
  calculateKPIWithDelta,
  generateBookedVsCapacityChart,
  generateDurationOverrunTrend,
  aggregateCapacityByDayStaff,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, SavedView } from '../types'

export function AppointmentsCapacity() {
  const navigate = useNavigate()
  const { filters, setFilters } = useReportFilters()
  const {
    appointments,
    previousAppointments,
    transactions,
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
  const [groupBy, setGroupBy] = useState<string>('day')
  const [compareMode, setCompareMode] = useState(false)

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateCapacityKPIs', () => {
      const currentBooked = calculateBookedAppointments(appointments)
      const previousBooked = calculateBookedAppointments(previousAppointments)

      const currentCompleted = calculateAppointmentsCompleted(appointments)
      const previousCompleted = calculateAppointmentsCompleted(previousAppointments)

      const currentCancelled = calculateCancelledAppointments(appointments)
      const previousCancelled = calculateCancelledAppointments(previousAppointments)

      const currentNoShow = calculateNoShowRate(appointments)
      const previousNoShow = calculateNoShowRate(previousAppointments)

      const currentLeadTime = calculateAvgLeadTime(appointments)
      const previousLeadTime = calculateAvgLeadTime(previousAppointments)

      const currentUtil = calculateUtilization(appointments, staff)
      const previousUtil = calculateUtilization(previousAppointments, staff)

      return [
        { metricId: 'bookedAppointments', value: calculateKPIWithDelta(currentBooked, previousBooked, 'number') },
        { metricId: 'appointmentsCompleted', value: calculateKPIWithDelta(currentCompleted, previousCompleted, 'number') },
        { metricId: 'cancelledAppointments', value: calculateKPIWithDelta(currentCancelled, previousCancelled, 'number') },
        { metricId: 'noShowRate', value: calculateKPIWithDelta(currentNoShow, previousNoShow, 'percent') },
        { metricId: 'avgLeadTime', value: calculateKPIWithDelta(currentLeadTime, previousLeadTime, 'number') },
        { metricId: 'utilizationPercent', value: calculateKPIWithDelta(currentUtil, previousUtil, 'percent') },
      ]
    })
  }, [appointments, previousAppointments, staff])

  // Generate insights
  const insights = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateCapacityInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions: [],
        inventoryItems: [],
        messages: [],
        filters,
      }).filter(i => ['capacity', 'utilization', 'booking', 'noshow'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, filters])

  // Chart data
  const bookedVsCapacityData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateBookedVsCapacity', () =>
      generateBookedVsCapacityChart(appointments, staff)
    )
  }, [appointments, staff])

  const durationOverrunData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateDurationOverrun', () =>
      generateDurationOverrunTrend(appointments)
    )
  }, [appointments])

  // Table data
  const tableData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('aggregateCapacityTable', () =>
      aggregateCapacityByDayStaff(appointments, staff, groupBy as unknown as number)
    )
  }, [appointments, staff, groupBy])

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    let rows: DrillRow[] = []
    let title = ''

    switch (metricId) {
      case 'bookedAppointments':
        rows = appointments.map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Booked Appointments'
        break
      case 'appointmentsCompleted':
        rows = appointments.filter(a => a.status === 'picked_up').map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Completed Appointments'
        break
      case 'cancelledAppointments':
        rows = appointments.filter(a => a.status === 'cancelled').map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Cancelled Appointments'
        break
      case 'noShowRate':
        rows = appointments.filter(a => a.status === 'no_show').map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'No-Shows'
        break
      default:
        rows = appointments.map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Appointments'
    }

    setDrillTitle(title)
    setDrillSubtitle(`${rows.length} appointments`)
    setDrillRows(rows)
    setDrillTotal({ label: title, value, format: ['noShowRate', 'utilizationPercent'].includes(metricId) ? 'percent' : 'number' })
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
    setDrillTotal({ label: 'Booked', value: row.metrics.booked || row.metrics.appointments, format: 'number' })
    setDrillOpen(true)
  }, [appointments, transactions])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'appointments-capacity', filters, groupBy, compareEnabled: compareMode })
  }, [saveView, filters, groupBy, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.groupBy) setGroupBy(view.groupBy)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  const handleExportCSV = useCallback(() => {
    const headers = ['Dimension', 'Slots', 'Capacity', 'Booked', 'Completed', 'No-Shows', 'Avg Duration', 'Overrun Min', 'Utilization %']
    const rows = tableData.map(row => [
      row.dimensionValue,
      row.metrics.slots || 0,
      row.metrics.capacity || 0,
      row.metrics.booked || 0,
      row.metrics.completed || 0,
      row.metrics.noShows || 0,
      (row.metrics.avgDuration || 0).toFixed(0),
      (row.metrics.overrunMinutes || 0).toFixed(0),
      (row.metrics.utilization || 0).toFixed(1),
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `appointments-capacity-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = ['Date', 'Time', 'Client', 'Pet', 'Groomer', 'Service', 'Duration', 'Status']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown> & { services?: Array<{ name?: string }> }
      return [d.serviceDate || '', d.startTime || '', d.clientName || '', d.petName || '', d.groomerName || '', d.services?.[0]?.name || '', d.actualDurationMinutes || d.estimatedDurationMinutes || '', d.status || '']
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `capacity-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  const formatMinutes = (v: number) => `${v.toFixed(0)} min`

  // Loading
  if (isLoading) {
    return (
      <ReportShell title="Appointments & Capacity" description="Scheduling efficiency" defaultTimeBasis="service">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
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
      <ReportShell title="Appointments & Capacity" description="Scheduling efficiency" defaultTimeBasis="service">
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertDescription>Failed to load appointment data.</AlertDescription>
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
      <ReportShell title="Appointments & Capacity" description="Scheduling efficiency" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Appointments</h2>
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
        title="Appointments & Capacity"
        description="Scheduling efficiency and capacity utilization"
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
          <ChartCard title="Booked vs Capacity" description="Appointment bookings relative to available capacity by day" ariaLabel="Bar chart of booked vs capacity">
            <SimpleBarChart 
              data={bookedVsCapacityData} 
              height={280} 
              formatValue={(v) => `${v}`}
              colorScheme="blue"
            />
          </ChartCard>

          <ChartCard title="Duration Overrun Trend" description="Average minutes over estimated duration" ariaLabel="Line chart of duration overrun">
            <SimpleLineChart 
              data={durationOverrunData} 
              height={280} 
              formatValue={formatMinutes}
            />
          </ChartCard>
        </div>

        {/* Data Table */}
        <DataTable
          title="Capacity Analysis"
          data={tableData}
          groupByOptions={[
            { value: 'day', label: 'By Day' },
            { value: 'staff', label: 'By Staff' },
            { value: 'dayStaff', label: 'By Day × Staff' },
            { value: 'week', label: 'By Week' },
          ]}
          selectedGroupBy={groupBy}
          onGroupByChange={setGroupBy}
          columns={[
            { id: 'slots', label: 'Slots', format: 'number', align: 'right', sortable: true },
            { id: 'capacity', label: 'Capacity', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'booked', label: 'Booked', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'completed', label: 'Completed', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'noShows', label: 'No-Shows', format: 'number', align: 'right', sortable: true },
            { id: 'avgDuration', label: 'Avg Duration', format: 'minutes', align: 'right', defaultVisible: true, sortable: true },
            { id: 'overrunMinutes', label: 'Overrun', format: 'minutes', align: 'right', sortable: true },
            { id: 'utilization', label: 'Utilization %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
          ]}
          onRowClick={handleRowDrill}
          onExport={handleExportCSV}
          maxPreviewRows={7}
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
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="appointments-capacity" filters={filters} groupBy={groupBy} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportCSV() } }} />
    </>
  )
}
