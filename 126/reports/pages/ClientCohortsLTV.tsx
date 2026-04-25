/**
 * Client Cohorts & LTV Report - Production Ready
 * Cohort analysis and lifetime value tracking
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
import { ChartCard, SimpleCohortGrid, SimpleBarChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DrillDrawer } from '../components/DrillDrawer'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { SaveViewDialog, ScheduleDialog, SavedViewsList } from '../components/SavedViewsManager'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData, useSavedViews, useReportSchedules } from '../hooks/useReportData'
import { generateInsights } from '../engine/insightsEngine'
import {
  calculateAvgLTV12m,
  calculateMedianVisits12m,
  calculateNewClients,
  calculateRetention90d,
  calculateRetention180d,
  calculateRetention360d,
  calculateKPIWithDelta,
  generateCohortRetentionGrid,
  generateLTVByChannelChart,
  aggregateCohortMetrics,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, SavedView } from '../types'

export function ClientCohortsLTV() {
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
  const [compareMode, setCompareMode] = useState(false)

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (clients.length === 0) return []

    return measurePerformance('calculateLTVKPIs', () => {
      const currentAvgLTV = calculateAvgLTV12m(clients, appointments)
      const previousAvgLTV = calculateAvgLTV12m(clients, previousAppointments)

      const currentMedianVisits = calculateMedianVisits12m(clients, appointments)
      const previousMedianVisits = calculateMedianVisits12m(clients, previousAppointments)

      const currentNewClients = calculateNewClients(clients, filters)
      const previousNewClients = calculateNewClients(clients, { ...filters, dateRange: 'custom' })

      const currentRet90 = calculateRetention90d(clients, appointments)
      const previousRet90 = calculateRetention90d(clients, previousAppointments)

      const currentRet180 = calculateRetention180d(clients, appointments)
      const previousRet180 = calculateRetention180d(clients, previousAppointments)

      const currentRet360 = calculateRetention360d(clients, appointments)
      const previousRet360 = calculateRetention360d(clients, previousAppointments)

      return [
        { metricId: 'avgLTV12m', value: calculateKPIWithDelta(currentAvgLTV, previousAvgLTV, 'money') },
        { metricId: 'medianVisits12m', value: calculateKPIWithDelta(currentMedianVisits, previousMedianVisits, 'number') },
        { metricId: 'newClients', value: calculateKPIWithDelta(currentNewClients, previousNewClients, 'number') },
        { metricId: 'retention90d', value: calculateKPIWithDelta(currentRet90, previousRet90, 'percent') },
        { metricId: 'retention180d', value: calculateKPIWithDelta(currentRet180, previousRet180, 'percent') },
        { metricId: 'retention360d', value: calculateKPIWithDelta(currentRet360, previousRet360, 'percent') },
      ]
    })
  }, [appointments, previousAppointments, clients, filters])

  // Generate insights
  const insights = useMemo(() => {
    if (clients.length === 0) return []
    return measurePerformance('generateLTVInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions: [],
        inventoryItems: [],
        messages: [],
        filters,
      }).filter(i => ['ltv', 'cohort', 'retention', 'acquisition'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, clients, filters])

  // Chart data
  const cohortGridData = useMemo(() => {
    if (clients.length === 0) return []
    return measurePerformance('generateCohortGrid', () =>
      generateCohortRetentionGrid(clients, appointments)
    )
  }, [clients, appointments])

  const ltvByChannelData = useMemo(() => {
    if (clients.length === 0) return []
    return measurePerformance('generateLTVByChannel', () =>
      generateLTVByChannelChart(clients, appointments)
    )
  }, [clients, appointments])

  // Table data
  const tableData = useMemo(() => {
    if (clients.length === 0) return []
    return measurePerformance('aggregateCohortTable', () =>
      aggregateCohortMetrics(clients, appointments)
    )
  }, [clients, appointments])

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    let rows: DrillRow[] = []
    let title = ''

    switch (metricId) {
      case 'newClients':
        rows = clients.filter(c => c.isNew).map(c => ({ id: c.id, type: 'client' as const, data: c, timestamp: c.firstVisitDate }))
        title = 'New Clients'
        break
      case 'avgLTV12m':
        rows = clients.slice(0, 100).map(c => ({ id: c.id, type: 'client' as const, data: c, timestamp: c.firstVisitDate }))
        title = 'Client LTV Sample'
        break
      default:
        rows = clients.map(c => ({ id: c.id, type: 'client' as const, data: c, timestamp: c.firstVisitDate }))
        title = 'Clients'
    }

    setDrillTitle(title)
    setDrillSubtitle(`${rows.length} clients`)
    setDrillRows(rows)
    setDrillTotal({ label: title, value, format: metricId.includes('LTV') ? 'money' : metricId.includes('retention') ? 'percent' : 'number' })
    setDrillOpen(true)
  }, [clients])

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
    const cohortClients = clients.filter(c => {
      const cohortMonth = new Date(c.firstVisitDate).toISOString().slice(0, 7)
      return cohortMonth === row.dimensionValue
    })
    const rows = cohortClients.map(c => ({ id: c.id, type: 'client' as const, data: c, timestamp: c.firstVisitDate }))
    setDrillTitle(`Cohort: ${row.dimensionValue}`)
    setDrillSubtitle(`${rows.length} clients`)
    setDrillRows(rows)
    setDrillTotal({ label: 'Revenue/Client', value: row.metrics.revenuePerClient || 0, format: 'money' })
    setDrillOpen(true)
  }, [clients])

  const handleCohortCellDrill = useCallback((cohort: string, period: number, value: number) => {
    const cohortClients = clients.filter(c => {
      const cohortMonth = new Date(c.firstVisitDate).toISOString().slice(0, 7)
      return cohortMonth === cohort
    })
    const rows = cohortClients.map(c => ({ id: c.id, type: 'client' as const, data: c, timestamp: c.firstVisitDate }))
    setDrillTitle(`${cohort} - Month ${period}`)
    setDrillSubtitle(`${value.toFixed(1)}% retention`)
    setDrillRows(rows)
    setDrillTotal({ label: 'Retention', value, format: 'percent' })
    setDrillOpen(true)
  }, [clients])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'client-cohorts-ltv', filters, compareEnabled: compareMode })
  }, [saveView, filters, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  const handleExportCSV = useCallback(() => {
    const headers = ['Cohort', 'Size', 'Retention %', 'Avg Orders', 'Revenue/Client', 'Margin/Client']
    const rows = tableData.map(row => [
      row.dimensionValue,
      row.metrics.cohortSize || 0,
      (row.metrics.retentionPct || 0).toFixed(1),
      (row.metrics.avgOrders || 0).toFixed(1),
      ((row.metrics.revenuePerClient || 0) / 100).toFixed(2),
      ((row.metrics.marginPerClient || 0) / 100).toFixed(2),
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `client-cohorts-ltv-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = ['Name', 'Email', 'First Visit', 'Total Visits', 'Lifetime Value']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown>
      return [d.name || '', d.email || '', d.firstVisitDate || '', d.visitCount || 0, ((d.lifetimeValueCents || 0) / 100).toFixed(2)]
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cohort-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`
  const formatPercent = (v: number) => `${v.toFixed(1)}%`

  // Loading
  if (isLoading) {
    return (
      <ReportShell title="Client Cohorts & LTV" description="Lifetime value analysis" defaultTimeBasis="service">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-3"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-24" /></Card>
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </ReportShell>
    )
  }

  // Error
  if (error) {
    return (
      <ReportShell title="Client Cohorts & LTV" description="Lifetime value analysis" defaultTimeBasis="service">
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
  if (clients.length === 0) {
    return (
      <ReportShell title="Client Cohorts & LTV" description="Lifetime value analysis" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Client Data</h2>
          <p className="text-muted-foreground mb-4">No clients found for cohort analysis.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
        <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell
        title="Client Cohorts & LTV"
        description="Cohort analysis and lifetime value tracking"
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
          <ChartCard title="Cohort Retention Grid" description="Monthly cohort retention over time" ariaLabel="Grid showing cohort retention percentages" className="lg:col-span-2">
            <SimpleCohortGrid 
              data={cohortGridData} 
              height={300} 
              formatValue={formatPercent}
              onCellClick={handleCohortCellDrill}
            />
          </ChartCard>

          <ChartCard title="LTV by Acquisition Channel" description="Average lifetime value by how clients were acquired" ariaLabel="Bar chart of LTV by channel" className="lg:col-span-2">
            <SimpleBarChart 
              data={ltvByChannelData} 
              height={280} 
              formatValue={formatMoney}
              colorScheme="green"
            />
          </ChartCard>
        </div>

        {/* Data Table */}
        <DataTable
          title="Cohort Metrics"
          data={tableData}
          columns={[
            { id: 'cohortSize', label: 'Cohort Size', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'retentionPct', label: 'Retention %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgOrders', label: 'Avg Orders', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'revenuePerClient', label: 'Revenue/Client', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'marginPerClient', label: 'Margin/Client', format: 'money', align: 'right', sortable: true },
          ]}
          onRowClick={handleRowDrill}
          onExport={handleExportCSV}
          maxPreviewRows={6}
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
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="client-cohorts-ltv" filters={filters} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportCSV() } }} />
    </>
  )
}
