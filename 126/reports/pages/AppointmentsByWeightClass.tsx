/**
 * Appointments by Weight Class Report
 * Appointment volume by dog size
 */

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Info, ArrowsClockwise } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { ChartCard, SimplePieChart } from '../components/ChartCard'
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

export function AppointmentsByWeightClass() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate by weight class
  const weightData = useMemo(() => {
    const byClass: Record<string, { count: number; revenue: number; avgDuration: number }> = {}
    let total = 0

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      total++
      const weightClass = getWeightClass(appt.petWeight)
      
      if (!byClass[weightClass]) {
        byClass[weightClass] = { count: 0, revenue: 0, avgDuration: 0 }
      }
      byClass[weightClass].count += 1
      byClass[weightClass].revenue += appt.netCents || 0
      byClass[weightClass].avgDuration += appt.durationMinutes || 60
    })

    return Object.entries(byClass).map(([weightClass, data]) => ({
      weightClass,
      count: data.count,
      revenue: data.revenue,
      avgDuration: data.count > 0 ? Math.round(data.avgDuration / data.count) : 0,
      share: total > 0 ? (data.count / total) * 100 : 0,
      avgTicket: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
    }))
  }, [appointments])

  // KPIs
  const kpis = useMemo(() => {
    const total = weightData.reduce((sum, w) => sum + w.count, 0)
    const topClass = weightData.sort((a, b) => b.count - a.count)[0]

    return [
      { metricId: 'totalAppointments', value: { current: total, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'weightClasses', value: { current: weightData.length, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'topClassCount', value: { current: topClass?.count || 0, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'topClassShare', value: { current: topClass?.share || 0, delta: 0, deltaPercent: 0, format: 'percent' as const } },
    ]
  }, [weightData])

  // Chart data
  const pieData = useMemo(() => {
    return weightData.map(w => ({
      label: w.weightClass,
      value: w.count,
    }))
  }, [weightData])

  // Table data
  const tableData = useMemo(() => {
    return weightData
      .sort((a, b) => b.count - a.count)
      .map(w => ({
        dimensionValue: w.weightClass,
        drillKey: `weightClass:${w.weightClass}`,
        metrics: {
          appointments: w.count,
          share: w.share,
          revenue: w.revenue,
          avgDuration: w.avgDuration,
          avgTicket: w.avgTicket,
        },
      }))
  }, [weightData])

  if (isLoading) {
    return (
      <ReportShell title="Appointments by Weight Class" description="Volume by dog size" defaultTimeBasis="service">
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
      <ReportShell title="Appointments by Weight Class" description="Volume by dog size" defaultTimeBasis="service">
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
      <ReportShell title="Appointments by Weight Class" description="Volume by dog size" defaultTimeBasis="service">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <p className="text-muted-foreground mb-4">No completed appointments found.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell
        title="Appointments by Weight Class"
        description="Appointment volume by dog size"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Appointment Distribution by Size" description="Volume by weight class" ariaLabel="Pie chart of appointments by weight class">
          <SimplePieChart data={pieData} height={280} formatValue={(v) => v.toString()} />
        </ChartCard>

        <DataTable
          title="Weight Class Details"
          data={tableData}
          columns={[
            { id: 'appointments', label: 'Appointments', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'share', label: 'Share %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgDuration', label: 'Avg Duration (min)', format: 'number', align: 'right', sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
