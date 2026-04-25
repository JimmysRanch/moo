/**
 * Revenue per Grooming Hour Report
 * Compare hourly earnings by weight class and service
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
  if (weightLbs <= 20) return 'Small'
  if (weightLbs <= 50) return 'Medium'
  if (weightLbs <= 80) return 'Large'
  return 'X-Large'
}

export function RevenuePerGroomingHour() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate revenue per hour by weight class
  const hourlyData = useMemo(() => {
    const byWeightClass: Record<string, { revenue: number; hours: number; count: number }> = {}
    const byService: Record<string, { revenue: number; hours: number; count: number }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      
      const weightClass = getWeightClass(appt.petWeight)
      const durationHours = (appt.durationMinutes || 60) / 60
      const revenue = appt.netCents || 0

      if (!byWeightClass[weightClass]) {
        byWeightClass[weightClass] = { revenue: 0, hours: 0, count: 0 }
      }
      byWeightClass[weightClass].revenue += revenue
      byWeightClass[weightClass].hours += durationHours
      byWeightClass[weightClass].count += 1

      appt.services?.forEach((svc) => {
        const svcName = svc.name || 'Unknown'
        if (!byService[svcName]) {
          byService[svcName] = { revenue: 0, hours: 0, count: 0 }
        }
        byService[svcName].revenue += svc.priceCents || 0
        byService[svcName].hours += durationHours / (appt.services?.length || 1)
        byService[svcName].count += 1
      })
    })

    return {
      byWeightClass: Object.entries(byWeightClass).map(([wc, data]) => ({
        name: wc,
        revenue: data.revenue,
        hours: data.hours,
        count: data.count,
        revenuePerHour: data.hours > 0 ? Math.round(data.revenue / data.hours) : 0,
      })),
      byService: Object.entries(byService).map(([svc, data]) => ({
        name: svc,
        revenue: data.revenue,
        hours: data.hours,
        count: data.count,
        revenuePerHour: data.hours > 0 ? Math.round(data.revenue / data.hours) : 0,
      })),
    }
  }, [appointments])

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = hourlyData.byWeightClass.reduce((sum, w) => sum + w.revenue, 0)
    const totalHours = hourlyData.byWeightClass.reduce((sum, w) => sum + w.hours, 0)
    const avgRevenuePerHour = totalHours > 0 ? Math.round(totalRevenue / totalHours) : 0
    const bestWeightClass = hourlyData.byWeightClass.sort((a, b) => b.revenuePerHour - a.revenuePerHour)[0]

    return [
      { metricId: 'totalRevenue', value: { current: totalRevenue, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'totalHours', value: { current: Math.round(totalHours * 10) / 10, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'avgRevenuePerHour', value: { current: avgRevenuePerHour, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'bestPerforming', value: { current: bestWeightClass?.revenuePerHour || 0, delta: 0, deltaPercent: 0, format: 'money' as const } },
    ]
  }, [hourlyData])

  // Table data
  const tableData = useMemo(() => {
    return hourlyData.byWeightClass
      .sort((a, b) => b.revenuePerHour - a.revenuePerHour)
      .map(wc => ({
        dimensionValue: wc.name,
        drillKey: `weightClass:${wc.name}`,
        metrics: {
          revenue: wc.revenue,
          hours: Math.round(wc.hours * 10) / 10,
          appointments: wc.count,
          revenuePerHour: wc.revenuePerHour,
        },
      }))
  }, [hourlyData])

  // Chart data
  const chartData = useMemo(() => {
    return hourlyData.byWeightClass
      .sort((a, b) => b.revenuePerHour - a.revenuePerHour)
      .map(wc => ({
        label: wc.name,
        value: wc.revenuePerHour,
      }))
  }, [hourlyData])

  if (isLoading) {
    return (
      <ReportShell title="Revenue per Grooming Hour" description="Hourly earnings analysis" defaultTimeBasis="service">
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
      <ReportShell title="Revenue per Grooming Hour" description="Hourly earnings analysis" defaultTimeBasis="service">
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
      <ReportShell title="Revenue per Grooming Hour" description="Hourly earnings analysis" defaultTimeBasis="service">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <p className="text-muted-foreground mb-4">No completed appointments found.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`

  return (
    <>
      <ReportShell
        title="Revenue per Grooming Hour"
        description="Compare hourly earnings by weight class and service"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Revenue per Hour by Weight Class" description="Hourly earnings comparison" ariaLabel="Bar chart of revenue per hour">
          <SimpleBarChart data={chartData} height={280} formatValue={formatMoney} />
        </ChartCard>

        <DataTable
          title="Weight Class Performance"
          data={tableData}
          columns={[
            { id: 'revenue', label: 'Total Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'hours', label: 'Hours', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'revenuePerHour', label: '$/Hour', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'appointments', label: 'Appointments', format: 'number', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
