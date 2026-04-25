/**
 * Owner Overview Report - Production Ready
 * High-level business health dashboard with full functionality
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Warning, 
  ArrowsClockwise,
  ArrowRight,
  Info,
} from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { InsightsStrip, InsightsEmptyState } from '../components/InsightsStrip'
import { ChartCard, SimpleLineChart, SimplePieChart, SimpleHeatmap } from '../components/ChartCard'
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
  calculateContributionMargin,
  calculateContributionMarginPercent,
  calculateAverageTicket,
  calculateAppointmentsCompleted,
  calculateNoShowRate,
  calculateRebook30d,
  calculateUtilization,
  calculateTotalTips,
  calculateKPIWithDelta,
  generateSalesByDayChart,
  generateSalesByServiceCategory,
  generateWeekdayHourHeatmap,
  aggregateByDimension,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, CompletenessIssue, SavedView } from '../types'

// Data completeness checker
function checkDataCompleteness(appointments: Record<string, unknown>[], staff: Record<string, unknown>[], inventoryItems: Record<string, unknown>[]): CompletenessIssue[] {
  const issues: CompletenessIssue[] = []
  
  if (inventoryItems.length === 0 || inventoryItems.every(i => !i.unitCostCents)) {
    issues.push({
      type: 'missing-supply-cost',
      description: 'Supply costs not configured. Margin calculations may be incomplete.',
      settingsLink: '/settings',
      affectedMetrics: ['contributionMargin', 'estimatedCOGS', 'grossMarginPercent'],
    })
  }
  
  if (staff.length === 0 || staff.every(s => !s.hourlyRateCents && !s.commissionPercent)) {
    issues.push({
      type: 'missing-labor-model',
      description: 'Staff compensation not configured. Labor cost calculations unavailable.',
      settingsLink: '/staff',
      affectedMetrics: ['directLabor', 'marginPerHour', 'totalPayout'],
    })
  }
  
  return issues
}

export function OwnerOverview() {
  const navigate = useNavigate()
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments, 
    transactions, 
    previousTransactions,
    staff,
    inventoryItems,
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
  
  // Check data completeness
  const completenessIssues = useMemo(() => 
    checkDataCompleteness(appointments, staff, inventoryItems),
    [appointments, staff, inventoryItems]
  )
  
  // Calculate KPIs with performance tracking
  const kpis = useMemo(() => {
    if (appointments.length === 0 && previousAppointments.length === 0) {
      return []
    }
    
    return measurePerformance('calculateOwnerOverviewKPIs', () => {
      const currentGross = calculateGrossSales(appointments)
      const previousGross = calculateGrossSales(previousAppointments)
      
      const currentNet = calculateNetSales(appointments, filters.includeDiscounts, filters.includeRefunds)
      const previousNet = calculateNetSales(previousAppointments, filters.includeDiscounts, filters.includeRefunds)
      
      const currentMargin = calculateContributionMargin(appointments, transactions)
      const previousMargin = calculateContributionMargin(previousAppointments, previousTransactions)
      
      const currentMarginPct = calculateContributionMarginPercent(appointments, transactions)
      const previousMarginPct = calculateContributionMarginPercent(previousAppointments, previousTransactions)
      
      const currentAvgTicket = calculateAverageTicket(appointments)
      const previousAvgTicket = calculateAverageTicket(previousAppointments)
      
      const currentCompleted = calculateAppointmentsCompleted(appointments)
      const previousCompleted = calculateAppointmentsCompleted(previousAppointments)
      
      const currentNoShow = calculateNoShowRate(appointments)
      const previousNoShow = calculateNoShowRate(previousAppointments)
      
      const currentRebook = calculateRebook30d(appointments)
      const previousRebook = calculateRebook30d(previousAppointments)
      
      const currentUtil = calculateUtilization(appointments, staff)
      const previousUtil = calculateUtilization(previousAppointments, staff)
      
      const currentTips = filters.includeTips ? calculateTotalTips(appointments) : 0
      const previousTips = filters.includeTips ? calculateTotalTips(previousAppointments) : 0
      
      return [
        { metricId: 'grossSales', value: calculateKPIWithDelta(currentGross, previousGross, 'money') },
        { metricId: 'netSales', value: calculateKPIWithDelta(currentNet, previousNet, 'money') },
        { metricId: 'contributionMargin', value: calculateKPIWithDelta(currentMargin, previousMargin, 'money') },
        { metricId: 'contributionMarginPercent', value: calculateKPIWithDelta(currentMarginPct, previousMarginPct, 'percent') },
        { metricId: 'avgTicket', value: calculateKPIWithDelta(currentAvgTicket, previousAvgTicket, 'money') },
        { metricId: 'appointmentsCompleted', value: calculateKPIWithDelta(currentCompleted, previousCompleted, 'number') },
        { metricId: 'noShowRate', value: calculateKPIWithDelta(currentNoShow, previousNoShow, 'percent') },
        { metricId: 'rebook30d', value: calculateKPIWithDelta(currentRebook, previousRebook, 'percent') },
        { metricId: 'utilizationPercent', value: calculateKPIWithDelta(currentUtil, previousUtil, 'percent') },
        { metricId: 'totalTips', value: calculateKPIWithDelta(currentTips, previousTips, 'money') },
      ]
    })
  }, [appointments, previousAppointments, transactions, previousTransactions, staff, filters])
  
  // Generate insights
  const insights = useMemo(() => {
    if (appointments.length === 0) return []
    
    return measurePerformance('generateOwnerOverviewInsights', () => 
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions,
        inventoryItems,
        messages,
        filters,
      })
    )
  }, [appointments, previousAppointments, transactions, previousTransactions, inventoryItems, messages, filters])
  
  // Chart data with memoization
  const salesTrendData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateSalesTrend', () => 
      generateSalesByDayChart(appointments, filters)
    )
  }, [appointments, filters])
  
  const previousSalesTrendData = useMemo(() => {
    if (!compareMode || previousAppointments.length === 0) return undefined
    return generateSalesByDayChart(previousAppointments, {
      ...filters,
      dateRange: 'custom',
    })
  }, [compareMode, previousAppointments, filters])
  
  const serviceMixData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateServiceMix', () => 
      generateSalesByServiceCategory(appointments)
    )
  }, [appointments])
  
  const heatmapData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateHeatmap', () => 
      generateWeekdayHourHeatmap(appointments)
    )
  }, [appointments])
  
  // Table data
  const tableData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('aggregateTableData', () => 
      aggregateByDimension(appointments, groupBy as 'service' | 'staff' | 'day' | 'week' | 'month' | 'channel' | 'clientType' | 'paymentMethod')
    )
  }, [appointments, groupBy])
  
  // Handle KPI click for drill-down
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    const rows: DrillRow[] = appointments
      .filter(a => a.status === 'picked_up')
      .map(a => ({
        id: a.id,
        type: 'appointment' as const,
        data: a,
        timestamp: a.serviceDate,
      }))
    
    const metricLabels: Record<string, string> = {
      grossSales: 'Gross Sales',
      netSales: 'Net Sales',
      contributionMargin: 'Contribution Margin',
      avgTicket: 'Average Ticket',
      appointmentsCompleted: 'Completed Appointments',
      totalTips: 'Total Tips',
    }
    
    setDrillTitle(`${metricLabels[metricId] || metricId} Details`)
    setDrillSubtitle(`${rows.length} appointments contributing to this metric`)
    setDrillRows(rows)
    setDrillTotal({ 
      label: metricLabels[metricId] || 'Value', 
      value, 
      format: ['appointmentsCompleted'].includes(metricId) ? 'number' : 'money' 
    })
    setDrillOpen(true)
  }, [appointments])
  
  // Handle insight click
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
  
  // Handle table row click
  const handleRowDrill = useCallback((row: AggregatedRow) => {
    const rows = getDrillRows(appointments, transactions, row.drillKey)
    setDrillTitle(`${row.dimensionValue}`)
    setDrillSubtitle(`${rows.length} appointments in this segment`)
    setDrillRows(rows)
    setDrillTotal({ label: 'Net Sales', value: row.metrics.netSales, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])
  
  // Handle chart segment click
  const handleChartDrill = useCallback((dataPoint: { label: string; value: number }) => {
    const rows = getDrillRows(appointments, transactions, `service:${dataPoint.label}`)
    setDrillTitle(dataPoint.label)
    setDrillSubtitle(`Revenue breakdown for ${dataPoint.label}`)
    setDrillRows(rows)
    setDrillTotal({ label: 'Revenue', value: dataPoint.value, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])
  
  // Handle heatmap cell click
  const handleHeatmapDrill = useCallback((cell: { weekday: string; hour: number; value: number }) => {
    const rows = appointments
      .filter(a => {
        const d = new Date(a.serviceDate)
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const h = parseInt(a.startTime.split(':')[0])
        return weekdays[d.getDay()] === cell.weekday && h === cell.hour
      })
      .map(a => ({
        id: a.id,
        type: 'appointment' as const,
        data: a,
        timestamp: a.serviceDate,
      }))
    
    setDrillTitle(`${cell.weekday} at ${cell.hour}:00`)
    setDrillSubtitle(`${rows.length} appointments during this time slot`)
    setDrillRows(rows)
    setDrillTotal({ label: 'Revenue', value: cell.value, format: 'money' })
    setDrillOpen(true)
  }, [appointments])
  
  // Handle save view
  const handleSaveView = useCallback((name: string) => {
    saveView({
      name,
      reportType: 'owner-overview',
      filters,
      groupBy,
      compareEnabled: compareMode,
    })
  }, [saveView, filters, groupBy, compareMode])
  
  // Handle apply saved view
  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.groupBy) setGroupBy(view.groupBy)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])
  
  // Handle schedule
  const handleSchedule = useCallback((config: Record<string, unknown>) => {
    createSchedule(config)
  }, [createSchedule])
  
  // Export CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['Dimension', 'Gross Sales', 'Net Sales', 'Discounts', 'Tips', 'Tax', 'Appointments', 'Avg Ticket', 'No-Show Rate']
    const rows = tableData.map(row => [
      row.dimensionValue,
      (row.metrics.grossSales / 100).toFixed(2),
      (row.metrics.netSales / 100).toFixed(2),
      (row.metrics.discounts / 100).toFixed(2),
      (row.metrics.tips / 100).toFixed(2),
      (row.metrics.tax / 100).toFixed(2),
      row.metrics.appointments,
      (row.metrics.avgTicket / 100).toFixed(2),
      row.metrics.noShowRate?.toFixed(1) || '0.0',
    ])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `owner-overview-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData])
  
  // Handle run now (preview)
  const handleRunNow = useCallback((savedViewId: string) => {
    const view = getView(savedViewId)
    if (!view) return
    markRun(savedViewId)
    handleExportCSV()
  }, [getView, markRun, handleExportCSV])
  
  // Export drill rows as CSV
  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    
    const headers = ['Date', 'Client', 'Pet', 'Groomer', 'Services', 'Net Amount', 'Tip', 'Status']
    const rows = drillRows.map(r => {
      const data = r.data as Record<string, unknown> & { services?: Array<{ name?: string }> }
      return [
        data.serviceDate || data.date || '',
        data.clientName || '',
        data.petName || '',
        data.groomerName || '',
        data.services?.map((s) => s.name).join('; ') || '',
        ((data.netCents as number || data.totalCents as number || 0) / 100).toFixed(2),
        ((data.tipCents as number || 0) / 100).toFixed(2),
        data.status || '',
      ]
    })
    
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `drill-export-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])
  
  const formatMoney = (value: number) => `$${(value / 100).toLocaleString()}`
  
  // Loading state
  if (isLoading) {
    return (
      <ReportShell title="Owner Overview" description="High-level business health metrics" defaultTimeBasis="checkout">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Card key={i} className="p-3">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </Card>
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
  
  // Error state
  if (error) {
    return (
      <ReportShell title="Owner Overview" description="High-level business health metrics" defaultTimeBasis="checkout">
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertDescription>Failed to load report data. Please try again.</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} className="mt-4">
          <ArrowsClockwise className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </ReportShell>
    )
  }
  
  // Empty state
  if (appointments.length === 0 && previousAppointments.length === 0) {
    return (
      <ReportShell title="Owner Overview" description="High-level business health metrics" defaultTimeBasis="checkout" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data Available</h2>
          <p className="text-muted-foreground mb-4">There are no appointments for the selected date range and filters.</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
            <Button onClick={() => navigate('/appointments/new')}>Create Appointment</Button>
          </div>
        </Card>
        <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
      </ReportShell>
    )
  }
  
  return (
    <>
      <ReportShell
        title="Owner Overview"
        description="High-level business health metrics"
        defaultTimeBasis="checkout"
        onSaveView={() => setShowSaveView(true)}
        onSchedule={() => setShowSchedule(true)}
        onExport={handleExportCSV}
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        {/* Data Completeness Badges */}
        {completenessIssues.length > 0 && (
          <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
            <Warning className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <span className="font-medium">Data Completeness Notice: </span>
              {completenessIssues.map((issue, i) => (
                <span key={i}>
                  {issue.description}
                  {issue.settingsLink && (
                    <Button variant="link" size="sm" className="h-auto p-0 ml-1 text-amber-700 dark:text-amber-300" onClick={() => navigate(issue.settingsLink)}>
                      Configure <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  )}
                  {i < completenessIssues.length - 1 && ' | '}
                </span>
              ))}
            </AlertDescription>
          </Alert>
        )}
        
        {/* KPI Deck */}
        <KPIDeck metrics={kpis.map(kpi => ({ ...kpi, onClick: () => handleKPIDrill(kpi.metricId, kpi.value.current) }))} />
        
        {/* Insights Strip */}
        {insights.length > 0 ? (
          <InsightsStrip insights={insights} onInsightClick={handleInsightClick} />
        ) : (
          <InsightsEmptyState />
        )}
        
        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Revenue Trend" description={`${filters.dateRange} • ${filters.timeBasis} date basis`} ariaLabel="Line chart showing revenue trend">
            <SimpleLineChart data={salesTrendData} previousData={compareMode ? previousSalesTrendData : undefined} height={280} formatValue={formatMoney} showArea />
          </ChartCard>
          
          <ChartCard title="Service Mix" description="Revenue distribution by service category" ariaLabel="Donut chart showing revenue by category">
            <SimplePieChart data={serviceMixData} height={280} formatValue={formatMoney} onClick={handleChartDrill} />
          </ChartCard>
        </div>
        
        {/* Heatmap */}
        <ChartCard title="Revenue Heatmap" description="Revenue intensity by day and hour" ariaLabel="Heatmap of revenue">
          <SimpleHeatmap data={heatmapData} height={220} formatValue={formatMoney} onClick={handleHeatmapDrill} />
        </ChartCard>
        
        {/* Data Table */}
        <DataTable
          title="Performance Drivers"
          data={tableData}
          groupByOptions={[
            { value: 'service', label: 'By Service' },
            { value: 'staff', label: 'By Staff' },
            { value: 'channel', label: 'By Channel' },
            { value: 'clientType', label: 'By Client Type' },
            { value: 'paymentMethod', label: 'By Payment Method' },
            { value: 'day', label: 'By Day' },
            { value: 'week', label: 'By Week' },
          ]}
          selectedGroupBy={groupBy}
          onGroupByChange={setGroupBy}
          columns={[
            { id: 'grossSales', label: 'Gross Sales', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'netSales', label: 'Net Sales', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'discounts', label: 'Discounts', format: 'money', align: 'right', sortable: true },
            { id: 'tips', label: 'Tips', format: 'money', align: 'right', sortable: true },
            { id: 'tax', label: 'Tax', format: 'money', align: 'right', sortable: true },
            { id: 'appointments', label: 'Appts', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'noShowRate', label: 'No-Show %', format: 'percent', align: 'right', sortable: true },
          ]}
          onRowClick={handleRowDrill}
          onExport={handleExportCSV}
          maxPreviewRows={5}
          showViewAll
        />
      </ReportShell>
      
      {/* Drill Drawer */}
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
      
      {/* Definitions Modal */}
      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
      
      {/* Save View Dialog */}
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="owner-overview" filters={filters} groupBy={groupBy} compareEnabled={compareMode} onSave={handleSaveView} />
      
      {/* Saved Views List */}
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      
      {/* Schedule Dialog */}
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={handleSchedule} onRunNow={handleRunNow} />
    </>
  )
}
