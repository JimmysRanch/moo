/**
 * Profit Margin by Weight Class Report
 * Unit economics after labor by dog size
 */

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Info, ArrowsClockwise } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { ChartCard, SimpleBarChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData } from '../hooks/useReportData'

function getWeightClass(weightLbs: number | undefined): string {
  if (!weightLbs) return 'Unknown'
  if (weightLbs <= 20) return 'Small (0-20 lbs)'
  if (weightLbs <= 50) return 'Medium (21-50 lbs)'
  if (weightLbs <= 80) return 'Large (51-80 lbs)'
  return 'X-Large (81+ lbs)'
}

export function ProfitMarginByWeightClass() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, staff, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate profit margins by weight class
  const marginData = useMemo(() => {
    const byClass: Record<string, { revenue: number; labor: number; supplies: number; count: number }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const weightClass = getWeightClass(appt.petWeight)
      const durationHours = (appt.durationMinutes || 60) / 60
      
      // Estimate labor cost based on groomer rate
      const groomer = staff.find(s => s.id === appt.groomerId)
      const hourlyRate = groomer?.hourlyRateCents || 2000 // Default $20/hr
      const laborCost = Math.round(hourlyRate * durationHours)
      
      // Estimate supplies cost (rough approximation)
      const suppliesCost = Math.round((appt.netCents || 0) * 0.05) // ~5% of revenue
      
      if (!byClass[weightClass]) {
        byClass[weightClass] = { revenue: 0, labor: 0, supplies: 0, count: 0 }
      }
      byClass[weightClass].revenue += appt.netCents || 0
      byClass[weightClass].labor += laborCost
      byClass[weightClass].supplies += suppliesCost
      byClass[weightClass].count += 1
    })

    return Object.entries(byClass).map(([weightClass, data]) => {
      const grossProfit = data.revenue - data.labor - data.supplies
      const marginPercent = data.revenue > 0 ? (grossProfit / data.revenue) * 100 : 0
      
      return {
        weightClass,
        revenue: data.revenue,
        labor: data.labor,
        supplies: data.supplies,
        grossProfit,
        marginPercent,
        count: data.count,
        avgProfit: data.count > 0 ? Math.round(grossProfit / data.count) : 0,
      }
    })
  }, [appointments, staff])

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = marginData.reduce((sum, m) => sum + m.revenue, 0)
    const totalLabor = marginData.reduce((sum, m) => sum + m.labor, 0)
    const totalSupplies = marginData.reduce((sum, m) => sum + m.supplies, 0)
    const totalProfit = totalRevenue - totalLabor - totalSupplies
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    return [
      { metricId: 'grossProfit', value: { current: totalProfit, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'laborCost', value: { current: totalLabor, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'suppliesCost', value: { current: totalSupplies, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'avgMargin', value: { current: avgMargin, delta: 0, deltaPercent: 0, format: 'percent' as const } },
    ]
  }, [marginData])

  // Table data
  const tableData = useMemo(() => {
    return marginData
      .sort((a, b) => b.marginPercent - a.marginPercent)
      .map(m => ({
        dimensionValue: m.weightClass,
        drillKey: `weightClass:${m.weightClass}`,
        metrics: {
          revenue: m.revenue,
          labor: m.labor,
          supplies: m.supplies,
          grossProfit: m.grossProfit,
          marginPercent: m.marginPercent,
          appointments: m.count,
          avgProfit: m.avgProfit,
        },
      }))
  }, [marginData])

  // Chart data
  const chartData = useMemo(() => {
    return marginData
      .sort((a, b) => b.marginPercent - a.marginPercent)
      .map(m => ({
        label: m.weightClass.split(' ')[0],
        value: m.marginPercent,
      }))
  }, [marginData])

  if (isLoading) {
    return (
      <ReportShell title="Profit Margin by Weight Class" description="Unit economics after labor" defaultTimeBasis="service">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-3"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-24" /></Card>
            ))}
          </div>
          <Skeleton className="h-[300px]" />
        </div>
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Profit Margin by Weight Class" description="Unit economics after labor" defaultTimeBasis="service">
        <Alert variant="destructive">
          <AlertDescription>Failed to load data.</AlertDescription>
        </Alert>
        <Button onClick={() => window.location.reload()} className="mt-4">
          <ArrowsClockwise className="mr-2 h-4 w-4" /> Retry
        </Button>
      </ReportShell>
    )
  }

  if (appointments.length === 0) {
    return (
      <ReportShell title="Profit Margin by Weight Class" description="Unit economics after labor" defaultTimeBasis="service">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <p className="text-muted-foreground mb-4">No completed appointments found.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  const formatPercent = (v: number) => `${v.toFixed(1)}%`

  return (
    <>
      <ReportShell
        title="Profit Margin by Weight Class"
        description="Unit economics after labor by dog size"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Margin % by Weight Class" description="Profit margin comparison" ariaLabel="Bar chart of margin by weight class">
          <SimpleBarChart data={chartData} height={280} formatValue={formatPercent} />
        </ChartCard>

        <DataTable
          title="Weight Class Economics"
          data={tableData}
          columns={[
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'labor', label: 'Labor', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'supplies', label: 'Supplies', format: 'money', align: 'right', sortable: true },
            { id: 'grossProfit', label: 'Profit', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'marginPercent', label: 'Margin %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'appointments', label: 'Appts', format: 'number', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
