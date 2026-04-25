/**
 * True Profit & Margin Report - Production Ready
 * Detailed profitability analysis with cost breakdowns
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Warning, ArrowsClockwise, ArrowRight, Info } from '@phosphor-icons/react'
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
  calculateContributionMargin,
  calculateContributionMarginPercent,
  calculateGrossMarginPercent,
  calculateAvgMarginPerAppt,
  calculateEstimatedCOGS,
  calculateProcessingFees,
  calculateDirectLabor,
  calculateKPIWithDelta,
  generateMarginByServiceChart,
  generateMarginByStaffChart,
  aggregateByDimension,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, SavedView, CompletenessIssue } from '../types'

function checkDataCompleteness(appointments: Record<string, unknown>[], staff: Record<string, unknown>[], inventoryItems: Record<string, unknown>[]): CompletenessIssue[] {
  const issues: CompletenessIssue[] = []
  
  const itemsWithoutCost = inventoryItems.filter(i => !i.unitCostCents).length
  if (itemsWithoutCost > 0) {
    issues.push({
      type: 'missing-supply-cost',
      description: `${itemsWithoutCost} inventory items missing unit costs. COGS may be underestimated.`,
      settingsLink: '/settings',
      affectedMetrics: ['estimatedCOGS', 'grossMarginPercent', 'contributionMargin'],
    })
  }
  
  const staffWithoutComp = staff.filter(s => !s.hourlyRateCents && !s.commissionPercent).length
  if (staffWithoutComp > 0) {
    issues.push({
      type: 'missing-labor-model',
      description: `${staffWithoutComp} staff members without compensation setup. Labor costs incomplete.`,
      settingsLink: '/staff',
      affectedMetrics: ['directLabor', 'contributionMargin', 'marginPerHour'],
    })
  }
  
  const appointmentsWithoutDuration = appointments.filter(a => !a.actualDurationMinutes && a.status === 'picked_up').length
  if (appointmentsWithoutDuration > 0) {
    issues.push({
      type: 'missing-duration',
      description: `${appointmentsWithoutDuration} appointments missing actual duration. Labor calculations use estimates.`,
      settingsLink: undefined,
      affectedMetrics: ['directLabor', 'durationVariance'],
    })
  }
  
  return issues
}

export function TrueProfitMargin() {
  const navigate = useNavigate()
  const { filters, setFilters } = useReportFilters()
  const {
    appointments,
    previousAppointments,
    transactions,
    previousTransactions,
    staff,
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
  const [groupBy, setGroupBy] = useState<string>('service')
  const [compareMode, setCompareMode] = useState(false)

  const completenessIssues = useMemo(() =>
    checkDataCompleteness(appointments, staff, inventoryItems),
    [appointments, staff, inventoryItems]
  )

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateTrueProfitKPIs', () => {
      const currentContribution = calculateContributionMargin(appointments, transactions)
      const previousContribution = calculateContributionMargin(previousAppointments, previousTransactions)

      const currentContribPct = calculateContributionMarginPercent(appointments, transactions)
      const previousContribPct = calculateContributionMarginPercent(previousAppointments, previousTransactions)

      const currentGrossMarginPct = calculateGrossMarginPercent(appointments, inventoryItems)
      const previousGrossMarginPct = calculateGrossMarginPercent(previousAppointments, inventoryItems)

      const currentAvgMargin = calculateAvgMarginPerAppt(appointments, transactions)
      const previousAvgMargin = calculateAvgMarginPerAppt(previousAppointments, previousTransactions)

      const currentCOGS = calculateEstimatedCOGS(appointments, inventoryItems)
      const previousCOGS = calculateEstimatedCOGS(previousAppointments, inventoryItems)

      const currentFees = calculateProcessingFees(transactions)
      const previousFees = calculateProcessingFees(previousTransactions)

      const currentLabor = calculateDirectLabor(appointments, staff)
      const previousLabor = calculateDirectLabor(previousAppointments, staff)

      return [
        { metricId: 'contributionMargin', value: calculateKPIWithDelta(currentContribution, previousContribution, 'money') },
        { metricId: 'contributionMarginPercent', value: calculateKPIWithDelta(currentContribPct, previousContribPct, 'percent') },
        { metricId: 'grossMarginPercent', value: calculateKPIWithDelta(currentGrossMarginPct, previousGrossMarginPct, 'percent') },
        { metricId: 'avgMarginPerAppt', value: calculateKPIWithDelta(currentAvgMargin, previousAvgMargin, 'money') },
        { metricId: 'estimatedCOGS', value: calculateKPIWithDelta(currentCOGS, previousCOGS, 'money') },
        { metricId: 'processingFees', value: calculateKPIWithDelta(currentFees, previousFees, 'money') },
        { metricId: 'directLabor', value: calculateKPIWithDelta(currentLabor, previousLabor, 'money') },
      ]
    })
  }, [appointments, previousAppointments, transactions, previousTransactions, staff, inventoryItems])

  // Generate insights
  const insights = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateProfitInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions,
        inventoryItems,
        messages: [],
        filters,
      }).filter(i => ['margin', 'cost', 'profit'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, previousTransactions, inventoryItems, filters])

  // Chart data
  const marginByServiceData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateMarginByService', () =>
      generateMarginByServiceChart(appointments, transactions, inventoryItems)
    )
  }, [appointments, transactions, inventoryItems])

  const marginByStaffData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateMarginByStaff', () =>
      generateMarginByStaffChart(appointments, transactions, staff)
    )
  }, [appointments, transactions, staff])

  // Table data with profit columns
  const tableData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('aggregateProfitTable', () => {
      const rows = aggregateByDimension(appointments, groupBy as 'service' | 'staff' | 'day' | 'week' | 'month' | 'channel' | 'clientType' | 'paymentMethod')
      // Add margin calculations per row
      return rows.map(row => ({
        ...row,
        metrics: {
          ...row.metrics,
          cogs: calculateEstimatedCOGS(
            appointments.filter(a => row.matchingIds.includes(a.id)),
            inventoryItems
          ),
          fees: calculateProcessingFees(
            transactions.filter(t => row.matchingIds.includes(t.appointmentId))
          ),
          labor: calculateDirectLabor(
            appointments.filter(a => row.matchingIds.includes(a.id)),
            staff
          ),
          contribution: calculateContributionMargin(
            appointments.filter(a => row.matchingIds.includes(a.id)),
            transactions.filter(t => row.matchingIds.includes(t.appointmentId))
          ),
          contributionPct: calculateContributionMarginPercent(
            appointments.filter(a => row.matchingIds.includes(a.id)),
            transactions.filter(t => row.matchingIds.includes(t.appointmentId))
          ),
          durationVariance: calculateDurationVariance(
            appointments.filter(a => row.matchingIds.includes(a.id))
          ),
          discountPct: row.metrics.discounts / (row.metrics.grossSales || 1) * 100,
        }
      }))
    })
  }, [appointments, transactions, inventoryItems, staff, groupBy])

  // Duration variance calculation
  function calculateDurationVariance(appts: Record<string, unknown>[]): number {
    const withDuration = appts.filter(a => a.actualDurationMinutes && a.estimatedDurationMinutes)
    if (withDuration.length === 0) return 0
    const totalVariance = withDuration.reduce((sum, a) => sum + (a.actualDurationMinutes - a.estimatedDurationMinutes), 0)
    return totalVariance / withDuration.length
  }

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    const rows: DrillRow[] = appointments
      .filter(a => a.status === 'picked_up')
      .map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))

    const labels: Record<string, string> = {
      contributionMargin: 'Contribution Margin',
      estimatedCOGS: 'Estimated COGS',
      processingFees: 'Processing Fees',
      directLabor: 'Direct Labor',
    }

    setDrillTitle(`${labels[metricId] || metricId} Details`)
    setDrillSubtitle(`${rows.length} appointments`)
    setDrillRows(rows)
    setDrillTotal({ label: labels[metricId] || 'Value', value, format: 'money' })
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
    setDrillTotal({ label: 'Contribution', value: row.metrics.contribution || 0, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])

  const handleChartDrill = useCallback((dataPoint: { label: string; value: number }) => {
    const rows = getDrillRows(appointments, transactions, `service:${dataPoint.label}`)
    setDrillTitle(dataPoint.label)
    setDrillSubtitle('Margin breakdown')
    setDrillRows(rows)
    setDrillTotal({ label: 'Margin', value: dataPoint.value, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'true-profit-margin', filters, groupBy, compareEnabled: compareMode })
  }, [saveView, filters, groupBy, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.groupBy) setGroupBy(view.groupBy)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  const handleExportCSV = useCallback(() => {
    const headers = ['Dimension', 'Net Sales', 'COGS', 'Fees', 'Labor', 'Contribution $', 'Contribution %', 'Appts', 'Avg Ticket', 'Duration Var', 'Discount %']
    const rows = tableData.map(row => [
      row.dimensionValue,
      (row.metrics.netSales / 100).toFixed(2),
      ((row.metrics.cogs || 0) / 100).toFixed(2),
      ((row.metrics.fees || 0) / 100).toFixed(2),
      ((row.metrics.labor || 0) / 100).toFixed(2),
      ((row.metrics.contribution || 0) / 100).toFixed(2),
      (row.metrics.contributionPct || 0).toFixed(1),
      row.metrics.appointments,
      (row.metrics.avgTicket / 100).toFixed(2),
      (row.metrics.durationVariance || 0).toFixed(1),
      (row.metrics.discountPct || 0).toFixed(1),
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `true-profit-margin-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = ['Date', 'Client', 'Pet', 'Groomer', 'Service', 'Net', 'COGS Est', 'Status']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown> & { services?: Array<{ name?: string }> }
      return [d.serviceDate || '', d.clientName || '', d.petName || '', d.groomerName || '', d.services?.[0]?.name || '', ((d.netCents || 0) / 100).toFixed(2), ((d.cogsEstCents || 0) / 100).toFixed(2), d.status || '']
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `profit-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`
  const formatPercent = (v: number) => `${v.toFixed(1)}%`

  // Loading
  if (isLoading) {
    return (
      <ReportShell title="True Profit & Margin" description="Profitability analysis" defaultTimeBasis="checkout">
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
      <ReportShell title="True Profit & Margin" description="Profitability analysis" defaultTimeBasis="checkout">
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
      <ReportShell title="True Profit & Margin" description="Profitability analysis" defaultTimeBasis="checkout" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data Available</h2>
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
        title="True Profit & Margin"
        description="Detailed profitability with cost breakdowns"
        defaultTimeBasis="checkout"
        onSaveView={() => setShowSaveView(true)}
        onSchedule={() => setShowSchedule(true)}
        onExport={handleExportCSV}
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        {/* Completeness warnings */}
        {completenessIssues.length > 0 && (
          <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
            <Warning className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <span className="font-medium">Data Completeness: </span>
              {completenessIssues.map((issue, i) => (
                <span key={i}>
                  {issue.description}
                  {issue.settingsLink && (
                    <Button variant="link" size="sm" className="h-auto p-0 ml-1 text-amber-700" onClick={() => navigate(issue.settingsLink)}>
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

        {/* Insights */}
        {insights.length > 0 ? (
          <InsightsStrip insights={insights} onInsightClick={handleInsightClick} />
        ) : (
          <InsightsEmptyState />
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Margin % by Service" description="Contribution margin percentage per service" ariaLabel="Bar chart of margin by service">
            <SimpleBarChart data={marginByServiceData} height={280} formatValue={formatPercent} onClick={handleChartDrill} colorScheme="green" />
          </ChartCard>

          <ChartCard title="Margin $ by Staff" description="Contribution dollars generated per staff member" ariaLabel="Bar chart of margin by staff">
            <SimpleBarChart data={marginByStaffData} height={280} formatValue={formatMoney} onClick={(dp) => {
              const rows = getDrillRows(appointments, transactions, `staff:${dp.label}`)
              setDrillTitle(dp.label)
              setDrillSubtitle('Staff margin breakdown')
              setDrillRows(rows)
              setDrillTotal({ label: 'Contribution', value: dp.value, format: 'money' })
              setDrillOpen(true)
            }} colorScheme="blue" />
          </ChartCard>
        </div>

        {/* Data Table */}
        <DataTable
          title="Profitability Analysis"
          data={tableData}
          groupByOptions={[
            { value: 'service', label: 'By Service' },
            { value: 'staff', label: 'By Staff' },
            { value: 'serviceCategory', label: 'By Category' },
            { value: 'day', label: 'By Day' },
            { value: 'week', label: 'By Week' },
            { value: 'month', label: 'By Month' },
          ]}
          selectedGroupBy={groupBy}
          onGroupByChange={setGroupBy}
          columns={[
            { id: 'netSales', label: 'Net Sales', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'cogs', label: 'COGS', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'fees', label: 'Fees', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'labor', label: 'Labor', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'contribution', label: 'Contribution $', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'contributionPct', label: 'Contribution %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'appointments', label: 'Appts', format: 'number', align: 'right', sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', sortable: true },
            { id: 'durationVariance', label: 'Duration Var', format: 'minutes', align: 'right', sortable: true },
            { id: 'discountPct', label: 'Discount %', format: 'percent', align: 'right', sortable: true },
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
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="true-profit-margin" filters={filters} groupBy={groupBy} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportCSV() } }} />
    </>
  )
}
