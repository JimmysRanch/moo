/**
 * Payroll / Compensation Report - Production Ready
 * Staff compensation tracking with permission gating
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Warning, ArrowsClockwise, Info, Lock, Export } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { InsightsStrip, InsightsEmptyState } from '../components/InsightsStrip'
import { DataTable } from '../components/DataTable'
import { DrillDrawer } from '../components/DrillDrawer'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { SaveViewDialog, ScheduleDialog, SavedViewsList } from '../components/SavedViewsManager'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData, useSavedViews, useReportSchedules, useUserPermissions } from '../hooks/useReportData'
import { generateInsights } from '../engine/insightsEngine'
import {
  calculateTotalPayout,
  calculateCommissionTotal,
  calculateHourlyTotal,
  calculateTipsTotal,
  calculateAdjustmentsTotal,
  calculateKPIWithDelta,
  aggregatePayrollByStaff,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, SavedView } from '../types'

export function PayrollCompensation() {
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
  const { canViewPayroll, canExportPayroll, role } = useUserPermissions()

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

    return measurePerformance('calculatePayrollKPIs', () => {
      const currentTotalPayout = calculateTotalPayout(appointments, staff)
      const previousTotalPayout = calculateTotalPayout(previousAppointments, staff)

      const currentCommission = calculateCommissionTotal(appointments, staff)
      const previousCommission = calculateCommissionTotal(previousAppointments, staff)

      const currentHourly = calculateHourlyTotal(appointments, staff)
      const previousHourly = calculateHourlyTotal(previousAppointments, staff)

      const currentTips = calculateTipsTotal(appointments)
      const previousTips = calculateTipsTotal(previousAppointments)

      const currentAdjustments = calculateAdjustmentsTotal(staff, filters)
      const previousAdjustments = calculateAdjustmentsTotal(staff, { ...filters, dateRange: 'custom' })

      return [
        { metricId: 'totalPayout', value: calculateKPIWithDelta(currentTotalPayout, previousTotalPayout, 'money') },
        { metricId: 'commissionTotal', value: calculateKPIWithDelta(currentCommission, previousCommission, 'money') },
        { metricId: 'hourlyTotal', value: calculateKPIWithDelta(currentHourly, previousHourly, 'money') },
        { metricId: 'tipsTotal', value: calculateKPIWithDelta(currentTips, previousTips, 'money') },
        { metricId: 'adjustmentsTotal', value: calculateKPIWithDelta(currentAdjustments, previousAdjustments, 'money') },
      ]
    })
  }, [appointments, previousAppointments, staff, filters])

  // Generate insights
  const insights = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generatePayrollInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions,
        inventoryItems: [],
        messages: [],
        filters,
      }).filter(i => ['payroll', 'compensation', 'commission', 'payout'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, previousTransactions, filters])

  // Table data
  const tableData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('aggregatePayrollTable', () =>
      aggregatePayrollByStaff(appointments, transactions, staff, filters)
    )
  }, [appointments, transactions, staff, filters])

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    const rows: DrillRow[] = appointments
      .filter(a => a.status === 'picked_up')
      .map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))

    const labels: Record<string, string> = {
      totalPayout: 'Total Payout',
      commissionTotal: 'Commission Total',
      hourlyTotal: 'Hourly Total',
      tipsTotal: 'Tips Total',
      adjustmentsTotal: 'Adjustments',
    }

    setDrillTitle(`${labels[metricId] || metricId} Details`)
    setDrillSubtitle(`${rows.length} completed appointments`)
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
    setDrillTotal({ label: 'Total Payout', value: row.metrics.totalPayout || 0, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'payroll-compensation', filters, compareEnabled: compareMode })
  }, [saveView, filters, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  // Payroll extract CSV export
  const handleExportPayrollCSV = useCallback(() => {
    if (!canExportPayroll) {
      alert('You do not have permission to export payroll data.')
      return
    }

    const headers = ['Staff Name', 'Staff ID', 'Commission', 'Hourly', 'Tips', 'Adjustments', 'Total Payout', 'Hours Worked', 'Appointments']
    const rows = tableData.map(row => [
      row.dimensionValue,
      row.metrics.staffId || '',
      ((row.metrics.commission || 0) / 100).toFixed(2),
      ((row.metrics.hourly || 0) / 100).toFixed(2),
      ((row.metrics.tips || 0) / 100).toFixed(2),
      ((row.metrics.adjustments || 0) / 100).toFixed(2),
      ((row.metrics.totalPayout || 0) / 100).toFixed(2),
      (row.metrics.hoursWorked || 0).toFixed(2),
      row.metrics.appointments || 0,
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
        link.download = `payroll-live-estimate-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData, canExportPayroll])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = ['Date', 'Client', 'Service', 'Revenue', 'Commission', 'Tip']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown> & { services?: Array<{ name?: string }> }
      return [d.serviceDate || '', d.clientName || '', d.services?.[0]?.name || '', ((d.netCents as number || 0) / 100).toFixed(2), ((d.commissionCents as number || 0) / 100).toFixed(2), ((d.tipCents as number || 0) / 100).toFixed(2)]
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payroll-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  // Permission check
  if (!canViewPayroll) {
    return (
        <ReportShell title="Payroll / Compensation" description="Live payroll estimate from completed appointments" defaultTimeBasis="checkout">
        <Card className="p-8 text-center">
          <Lock size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to view payroll data. Contact your administrator for access.
          </p>
          <Badge variant="outline">{role}</Badge>
        </Card>
      </ReportShell>
    )
  }

  // Loading
  if (isLoading) {
    return (
        <ReportShell title="Payroll / Compensation" description="Live payroll estimate from completed appointments" defaultTimeBasis="checkout">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-3"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-24" /></Card>
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-[400px]" />
        </div>
      </ReportShell>
    )
  }

  // Error
  if (error) {
    return (
      <ReportShell title="Payroll / Compensation" description="Staff compensation tracking" defaultTimeBasis="checkout">
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertDescription>Failed to load payroll data.</AlertDescription>
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
        <ReportShell title="Payroll / Compensation" description="Live payroll estimate from completed appointments" defaultTimeBasis="checkout" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Payroll Data</h2>
          <p className="text-muted-foreground mb-4">No completed appointments found for the selected pay period.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last30' })}>Try Last 30 Days</Button>
        </Card>
        <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell
        title="Payroll / Compensation"
          description="Live payroll estimate from completed appointments; finalized payroll history is stored in Run Payroll"
        defaultTimeBasis="checkout"
        onSaveView={() => setShowSaveView(true)}
        onSchedule={() => setShowSchedule(true)}
        onExport={handleExportPayrollCSV}
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        {/* Security notice */}
        <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <Lock className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <span className="font-medium">Confidential Data: </span>
            Payroll information is restricted. Your access level: <Badge variant="outline" className="ml-1">{role}</Badge>
          </AlertDescription>
        </Alert>

        <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            This report is a live estimate from completed appointments and checkout totals. Finalized or paid payroll history lives in the Run Payroll flow.
          </AlertDescription>
        </Alert>

        {/* KPI Deck */}
        <KPIDeck metrics={kpis.map(kpi => ({ ...kpi, onClick: () => handleKPIDrill(kpi.metricId, kpi.value.current) }))} />

        {/* Insights */}
        {insights.length > 0 ? (
          <InsightsStrip insights={insights} onInsightClick={handleInsightClick} />
        ) : (
          <InsightsEmptyState />
        )}

        {/* Export Action */}
        {canExportPayroll && (
          <Card className="p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200">Payroll Extract</h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Export the current live payroll estimate for accounting review
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportPayrollCSV}>
                <Export className="mr-2 h-4 w-4" />
                Export Live Estimate CSV
              </Button>
            </div>
          </Card>
        )}

        {/* Data Table */}
        <DataTable
          title="Staff Payroll Summary (Live Estimate)"
          data={tableData}
          columns={[
            { id: 'commission', label: 'Commission', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'hourly', label: 'Hourly', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tips', label: 'Tips', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'adjustments', label: 'Adjustments', format: 'money', align: 'right', sortable: true },
            { id: 'totalPayout', label: 'Total Payout', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'hoursWorked', label: 'Hours', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'appointments', label: 'Appts', format: 'number', align: 'right', sortable: true },
          ]}
          onRowClick={handleRowDrill}
          onExport={handleExportPayrollCSV}
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
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="payroll-compensation" filters={filters} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportPayrollCSV() } }} />
    </>
  )
}
