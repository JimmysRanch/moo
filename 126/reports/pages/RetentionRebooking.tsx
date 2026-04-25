/**
 * Retention & Rebooking Report - Production Ready
 * Client retention and rebooking behavior analysis
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Warning, ArrowsClockwise, Info, Export } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { InsightsStrip, InsightsEmptyState } from '../components/InsightsStrip'
import { ChartCard, SimpleFunnelChart, SimpleBarChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DrillDrawer } from '../components/DrillDrawer'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { SaveViewDialog, ScheduleDialog, SavedViewsList } from '../components/SavedViewsManager'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData, useSavedViews, useReportSchedules } from '../hooks/useReportData'
import { generateInsights } from '../engine/insightsEngine'
import {
  calculateRebook24h,
  calculateRebook7d,
  calculateRebook30d,
  calculateAvgDaysToNextVisit,
  calculateReturn90d,
  calculateKPIWithDelta,
  generateRebookFunnel,
  generateTimeToReturnDistribution,
  aggregateRetentionBySegment,
  getAtRiskClients,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, SavedView } from '../types'

export function RetentionRebooking() {
  const navigate = useNavigate()
  const { filters, setFilters } = useReportFilters()
  const {
    appointments,
    previousAppointments,
    transactions,
    clients,
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

    return measurePerformance('calculateRetentionKPIs', () => {
      const currentRebook24h = calculateRebook24h(appointments)
      const previousRebook24h = calculateRebook24h(previousAppointments)

      const currentRebook7d = calculateRebook7d(appointments)
      const previousRebook7d = calculateRebook7d(previousAppointments)

      const currentRebook30d = calculateRebook30d(appointments)
      const previousRebook30d = calculateRebook30d(previousAppointments)

      const currentAvgDays = calculateAvgDaysToNextVisit(appointments, clients)
      const previousAvgDays = calculateAvgDaysToNextVisit(previousAppointments, clients)

      const currentReturn90d = calculateReturn90d(appointments, clients)
      const previousReturn90d = calculateReturn90d(previousAppointments, clients)

      return [
        { metricId: 'rebook24h', value: calculateKPIWithDelta(currentRebook24h, previousRebook24h, 'percent') },
        { metricId: 'rebook7d', value: calculateKPIWithDelta(currentRebook7d, previousRebook7d, 'percent') },
        { metricId: 'rebook30d', value: calculateKPIWithDelta(currentRebook30d, previousRebook30d, 'percent') },
        { metricId: 'avgDaysToNextVisit', value: calculateKPIWithDelta(currentAvgDays, previousAvgDays, 'number') },
        { metricId: 'return90d', value: calculateKPIWithDelta(currentReturn90d, previousReturn90d, 'percent') },
      ]
    })
  }, [appointments, previousAppointments, clients])

  // Generate insights
  const insights = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateRetentionInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions: [],
        inventoryItems: [],
        messages: [],
        filters,
      }).filter(i => ['retention', 'rebook', 'churn', 'lapsed'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, filters])

  // Chart data
  const rebookFunnelData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateRebookFunnel', () =>
      generateRebookFunnel(appointments)
    )
  }, [appointments])

  const timeToReturnData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateTimeToReturn', () =>
      generateTimeToReturnDistribution(appointments, clients)
    )
  }, [appointments, clients])

  // Table data
  const tableData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('aggregateRetentionTable', () =>
      aggregateRetentionBySegment(appointments, clients, groupBy as 'service' | 'staff' | 'clientType' | 'rfm')
    )
  }, [appointments, clients, groupBy])

  // At-risk clients for export action
  const atRiskClients = useMemo(() => {
    return measurePerformance('getAtRiskClients', () =>
      getAtRiskClients(appointments, clients)
    )
  }, [appointments, clients])

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    let rows: DrillRow[] = []
    let title = ''

    switch (metricId) {
      case 'rebook24h':
        rows = appointments.filter(a => a.rebookedWithin24h).map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Rebooked within 24h'
        break
      case 'rebook7d':
        rows = appointments.filter(a => a.rebookedWithin7d).map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Rebooked within 7 days'
        break
      case 'rebook30d':
        rows = appointments.filter(a => a.rebookedWithin30d).map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Rebooked within 30 days'
        break
      case 'return90d':
        rows = clients.filter(c => c.lastVisitDaysAgo <= 90 && c.visitCount > 1).map(c => ({ id: c.id, type: 'client' as const, data: c, timestamp: c.lastVisitDate }))
        title = 'Returned within 90 days'
        break
      default:
        rows = appointments.map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Appointments'
    }

    setDrillTitle(title)
    setDrillSubtitle(`${rows.length} ${metricId.includes('return') ? 'clients' : 'appointments'}`)
    setDrillRows(rows)
    setDrillTotal({ label: title, value, format: metricId === 'avgDaysToNextVisit' ? 'number' : 'percent' })
    setDrillOpen(true)
  }, [appointments, clients])

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
    setDrillTotal({ label: 'Rebook Rate (7d)', value: row.metrics.rebook7d || 0, format: 'percent' })
    setDrillOpen(true)
  }, [appointments, transactions])

  // Export at-risk clients
  const handleExportAtRisk = useCallback(() => {
    const headers = ['Client Name', 'Email', 'Phone', 'Last Visit', 'Days Since Visit', 'Total Visits', 'Lifetime Value']
    const rows = atRiskClients.map(c => [
      c.name,
      c.email || '',
      c.phone || '',
      c.lastVisitDate || '',
      c.daysSinceLastVisit,
      c.totalVisits,
      (c.lifetimeValueCents / 100).toFixed(2),
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `at-risk-clients-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [atRiskClients])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'retention-rebooking', filters, groupBy, compareEnabled: compareMode })
  }, [saveView, filters, groupBy, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.groupBy) setGroupBy(view.groupBy)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  const handleExportCSV = useCallback(() => {
    const headers = ['Segment', 'Rebook 24h', 'Rebook 7d', 'Rebook 30d', 'Avg Interval', 'Lapsed >90d', 'Total Clients']
    const rows = tableData.map(row => [
      row.dimensionValue,
      (row.metrics.rebook24h || 0).toFixed(1),
      (row.metrics.rebook7d || 0).toFixed(1),
      (row.metrics.rebook30d || 0).toFixed(1),
      (row.metrics.avgInterval || 0).toFixed(1),
      row.metrics.lapsedCount || 0,
      row.metrics.totalClients || 0,
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `retention-rebooking-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = drillRows[0]?.type === 'client' 
      ? ['Name', 'Email', 'Last Visit', 'Total Visits']
      : ['Date', 'Client', 'Service', 'Rebooked']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown> & { services?: Array<{ name?: string }> }
      if (r.type === 'client') {
        return [d.name || '', d.email || '', d.lastVisitDate || '', d.visitCount || 0]
      }
      return [d.serviceDate || '', d.clientName || '', d.services?.[0]?.name || '', d.rebookedWithin7d ? 'Yes' : 'No']
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `retention-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  const formatPercent = (v: number) => `${v.toFixed(1)}%`

  // Loading
  if (isLoading) {
    return (
      <ReportShell title="Retention & Rebooking" description="Client retention analysis" defaultTimeBasis="service">
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
      <ReportShell title="Retention & Rebooking" description="Client retention analysis" defaultTimeBasis="service">
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
      <ReportShell title="Retention & Rebooking" description="Client retention analysis" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
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
        title="Retention & Rebooking"
        description="Client retention and rebooking behavior analysis"
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

        {/* Action: Export At-Risk List */}
        {atRiskClients.length > 0 && (
          <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">At-Risk Clients</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {atRiskClients.length} clients haven't visited in 90+ days
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportAtRisk}>
                <Export className="mr-2 h-4 w-4" />
                Export At-Risk List
              </Button>
            </div>
          </Card>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Rebooking Funnel" description="Client rebooking progression" ariaLabel="Funnel chart of rebooking windows">
            <SimpleFunnelChart 
              data={rebookFunnelData} 
              height={280} 
              formatValue={formatPercent}
            />
          </ChartCard>

          <ChartCard title="Time to Return Distribution" description="Days between visits" ariaLabel="Bar chart of return time distribution">
            <SimpleBarChart 
              data={timeToReturnData} 
              height={280} 
              formatValue={(v) => `${v}`}
              colorScheme="green"
            />
          </ChartCard>
        </div>

        {/* Data Table */}
        <DataTable
          title="Retention by Segment"
          data={tableData}
          groupByOptions={[
            { value: 'service', label: 'By Service' },
            { value: 'staff', label: 'By Staff' },
            { value: 'segment', label: 'By Segment' },
            { value: 'rfm', label: 'By RFM Score' },
          ]}
          selectedGroupBy={groupBy}
          onGroupByChange={setGroupBy}
          columns={[
            { id: 'rebook24h', label: 'Rebook 0-24h', format: 'percent', align: 'right', sortable: true },
            { id: 'rebook7d', label: 'Rebook ≤7d', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'rebook30d', label: 'Rebook ≤30d', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgInterval', label: 'Avg Interval', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'lapsedCount', label: 'Lapsed >90d', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'totalClients', label: 'Total Clients', format: 'number', align: 'right', sortable: true },
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
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="retention-rebooking" filters={filters} groupBy={groupBy} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportCSV() } }} />
    </>
  )
}
