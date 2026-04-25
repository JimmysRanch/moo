/**
 * Taxes Summary Report - Production Ready
 * Tax collection tracking by jurisdiction and rate
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
import { ChartCard, SimpleBarChart, SimplePieChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DrillDrawer } from '../components/DrillDrawer'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { SaveViewDialog, ScheduleDialog, SavedViewsList } from '../components/SavedViewsManager'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData, useSavedViews, useReportSchedules } from '../hooks/useReportData'
import { generateInsights } from '../engine/insightsEngine'
import {
  calculateTaxableSales,
  calculateNonTaxableSales,
  calculateTotalTax,
  calculateKPIWithDelta,
  generateTaxByJurisdictionChart,
  generateTaxablePieChart,
  aggregateTaxByJurisdiction,
  getDrillRows,
  measurePerformance,
} from '../engine/analyticsEngine'
import { DrillRow, Insight, AggregatedRow, SavedView } from '../types'

export function TaxesSummary() {
  const navigate = useNavigate()
  const { filters, setFilters } = useReportFilters()
  const {
    appointments,
    previousAppointments,
    transactions,
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

    return measurePerformance('calculateTaxKPIs', () => {
      const currentTaxable = calculateTaxableSales(appointments)
      const previousTaxable = calculateTaxableSales(previousAppointments)

      const currentNonTaxable = calculateNonTaxableSales(appointments)
      const previousNonTaxable = calculateNonTaxableSales(previousAppointments)

      const currentTax = calculateTotalTax(appointments)
      const previousTax = calculateTotalTax(previousAppointments)

      return [
        { metricId: 'taxableSales', value: calculateKPIWithDelta(currentTaxable, previousTaxable, 'money') },
        { metricId: 'nonTaxableSales', value: calculateKPIWithDelta(currentNonTaxable, previousNonTaxable, 'money') },
        { metricId: 'taxCollected', value: calculateKPIWithDelta(currentTax, previousTax, 'money') },
      ]
    })
  }, [appointments, previousAppointments])

  // Generate insights
  const insights = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateTaxInsights', () =>
      generateInsights({
        appointments,
        previousAppointments,
        transactions,
        previousTransactions: [],
        inventoryItems: [],
        messages: [],
        filters,
      }).filter(i => ['tax'].some(k => i.category.includes(k)))
    )
  }, [appointments, previousAppointments, transactions, filters])

  // Chart data
  const taxByJurisdictionData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateTaxByJurisdiction', () =>
      generateTaxByJurisdictionChart(appointments)
    )
  }, [appointments])

  const taxablePieData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('generateTaxablePie', () =>
      generateTaxablePieChart(appointments)
    )
  }, [appointments])

  // Table data
  const tableData = useMemo(() => {
    if (appointments.length === 0) return []
    return measurePerformance('aggregateTaxTable', () =>
      aggregateTaxByJurisdiction(appointments)
    )
  }, [appointments])

  // Drill handlers
  const handleKPIDrill = useCallback((metricId: string, value: number) => {
    let rows: DrillRow[] = []
    let title = ''

    switch (metricId) {
      case 'taxableSales':
        rows = appointments.filter(a => a.status === 'picked_up' && a.isTaxable).map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Taxable Sales'
        break
      case 'nonTaxableSales':
        rows = appointments.filter(a => a.status === 'picked_up' && !a.isTaxable).map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Non-Taxable Sales'
        break
      case 'taxCollected':
        rows = appointments.filter(a => a.status === 'picked_up' && (a.taxCents || 0) > 0).map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Tax Collected'
        break
      default:
        rows = appointments.map(a => ({ id: a.id, type: 'appointment' as const, data: a, timestamp: a.serviceDate }))
        title = 'Appointments'
    }

    setDrillTitle(title)
    setDrillSubtitle(`${rows.length} appointments`)
    setDrillRows(rows)
    setDrillTotal({ label: title, value, format: 'money' })
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
    setDrillSubtitle(`${rows.length} invoices`)
    setDrillRows(rows)
    setDrillTotal({ label: 'Tax', value: row.metrics.taxCollected || 0, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])

  const handleChartDrill = useCallback((dataPoint: { label: string; value: number }) => {
    const rows = getDrillRows(appointments, transactions, `jurisdiction:${dataPoint.label}`)
    setDrillTitle(dataPoint.label)
    setDrillSubtitle('Tax jurisdiction breakdown')
    setDrillRows(rows)
    setDrillTotal({ label: 'Tax', value: dataPoint.value, format: 'money' })
    setDrillOpen(true)
  }, [appointments, transactions])

  // Save/Export handlers
  const handleSaveView = useCallback((name: string) => {
    saveView({ name, reportType: 'taxes-summary', filters, compareEnabled: compareMode })
  }, [saveView, filters, compareMode])

  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters)
    if (view.compareEnabled !== undefined) setCompareMode(view.compareEnabled)
    setShowSavedViews(false)
  }, [setFilters])

  const handleExportCSV = useCallback(() => {
    const headers = ['Jurisdiction', 'Tax Rate', 'Taxable Base', 'Tax Collected', 'Invoice Count']
    const rows = tableData.map(row => [
      row.dimensionValue,
      (row.metrics.taxRate || 0).toFixed(3),
      ((row.metrics.taxableBase || 0) / 100).toFixed(2),
      ((row.metrics.taxCollected || 0) / 100).toFixed(2),
      row.metrics.invoiceCount || 0,
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `taxes-summary-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [tableData])

  const handleExportDrillCSV = useCallback(() => {
    if (drillRows.length === 0) return
    const headers = ['Date', 'Client', 'Service', 'Taxable Amount', 'Tax Rate', 'Tax']
    const rows = drillRows.map(r => {
      const d = r.data as Record<string, unknown> & { services?: Array<{ name?: string }> }
      return [d.serviceDate || '', d.clientName || '', d.services?.[0]?.name || '', ((d.taxableAmountCents || d.netCents || 0) / 100).toFixed(2), (d.taxRate || 0).toFixed(3), ((d.taxCents || 0) / 100).toFixed(2)]
    })
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `taxes-drill-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [drillRows])

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`

  // Loading
  if (isLoading) {
    return (
      <ReportShell title="Taxes Summary" description="Tax collection tracking" defaultTimeBasis="checkout">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
      <ReportShell title="Taxes Summary" description="Tax collection tracking" defaultTimeBasis="checkout">
        <Alert variant="destructive">
          <Warning className="h-4 w-4" />
          <AlertDescription>Failed to load tax data.</AlertDescription>
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
      <ReportShell title="Taxes Summary" description="Tax collection tracking" defaultTimeBasis="checkout" onShowDefinitions={() => setShowDefinitions(true)}>
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Tax Data</h2>
          <p className="text-muted-foreground mb-4">No completed appointments with tax found for the selected filters.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
        <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell
        title="Taxes Summary"
        description="Tax collection tracking by jurisdiction and rate"
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
          <ChartCard title="Tax by Jurisdiction" description="Tax collected by jurisdiction" ariaLabel="Bar chart of tax by jurisdiction">
            <SimpleBarChart 
              data={taxByJurisdictionData} 
              height={280} 
              formatValue={formatMoney}
              onClick={handleChartDrill}
              colorScheme="blue"
            />
          </ChartCard>

          <ChartCard title="Taxable vs Non-Taxable" description="Sales breakdown by taxability" ariaLabel="Pie chart of taxable vs non-taxable sales">
            <SimplePieChart 
              data={taxablePieData} 
              height={280} 
              formatValue={formatMoney}
            />
          </ChartCard>
        </div>

        {/* Data Table */}
        <DataTable
          title="Tax by Jurisdiction"
          data={tableData}
          columns={[
            { id: 'taxRate', label: 'Rate', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'taxableBase', label: 'Taxable Base', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'taxCollected', label: 'Tax Collected', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'invoiceCount', label: 'Invoices', format: 'number', align: 'right', defaultVisible: true, sortable: true },
          ]}
          onRowClick={handleRowDrill}
          onExport={handleExportCSV}
          maxPreviewRows={10}
          showViewAll
        />

        {/* Summary Card */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Tax Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Taxable</div>
              <div className="text-lg font-bold">{formatMoney(kpis.find(k => k.metricId === 'taxableSales')?.value.current || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Non-Taxable</div>
              <div className="text-lg font-bold">{formatMoney(kpis.find(k => k.metricId === 'nonTaxableSales')?.value.current || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Tax Collected</div>
              <div className="text-lg font-bold">{formatMoney(kpis.find(k => k.metricId === 'taxCollected')?.value.current || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Effective Rate</div>
              <div className="text-lg font-bold">
                {(() => {
                  const taxable = kpis.find(k => k.metricId === 'taxableSales')?.value.current || 0
                  const tax = kpis.find(k => k.metricId === 'taxCollected')?.value.current || 0
                  return taxable > 0 ? `${(tax / taxable * 100).toFixed(2)}%` : '0.00%'
                })()}
              </div>
            </div>
          </div>
        </Card>
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
      <SaveViewDialog open={showSaveView} onClose={() => setShowSaveView(false)} reportType="taxes-summary" filters={filters} compareEnabled={compareMode} onSave={handleSaveView} />
      <SavedViewsList open={showSavedViews} onClose={() => setShowSavedViews(false)} onApply={handleApplyView} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} savedViews={savedViews as SavedView[]} onSchedule={(c) => createSchedule(c)} onRunNow={(id) => { const v = getView(id); if (v) { markRun(id); handleExportCSV() } }} />
    </>
  )
}
