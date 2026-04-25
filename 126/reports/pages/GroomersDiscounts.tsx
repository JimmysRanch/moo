/**
 * Groomers Discounts Report
 * Track discounts given by each groomer
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

export function GroomersDiscounts() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, staff, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate discount metrics by groomer
  const groomerData = useMemo(() => {
    const byGroomer: Record<string, { discounts: number; appointments: number; revenue: number }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const groomerId = appt.groomerId || 'unassigned'
      const groomer = staff.find(s => s.id === groomerId)
      const groomerName = groomer?.name || 'Unassigned'
      
      if (!byGroomer[groomerName]) {
        byGroomer[groomerName] = { discounts: 0, appointments: 0, revenue: 0 }
      }
      byGroomer[groomerName].discounts += appt.discountCents || 0
      byGroomer[groomerName].appointments += 1
      byGroomer[groomerName].revenue += appt.netCents || 0
    })

    return Object.entries(byGroomer).map(([name, data]) => ({
      name,
      discounts: data.discounts,
      appointments: data.appointments,
      revenue: data.revenue,
      avgDiscount: data.appointments > 0 ? Math.round(data.discounts / data.appointments) : 0,
      discountRate: data.revenue > 0 ? (data.discounts / (data.revenue + data.discounts)) * 100 : 0,
    }))
  }, [appointments, staff])

  // KPIs
  const kpis = useMemo(() => {
    const totalDiscounts = groomerData.reduce((sum, g) => sum + g.discounts, 0)
    const totalAppointments = groomerData.reduce((sum, g) => sum + g.appointments, 0)
    const avgDiscountPerAppt = totalAppointments > 0 ? Math.round(totalDiscounts / totalAppointments) : 0
    const topDiscounter = groomerData.sort((a, b) => b.discounts - a.discounts)[0]

    return [
      { metricId: 'totalDiscounts', value: { current: totalDiscounts, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'avgPerAppt', value: { current: avgDiscountPerAppt, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'groomersWithDiscounts', value: { current: groomerData.filter(g => g.discounts > 0).length, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'topDiscounter', value: { current: topDiscounter?.discounts || 0, delta: 0, deltaPercent: 0, format: 'money' as const } },
    ]
  }, [groomerData])

  // Table data
  const tableData = useMemo(() => {
    return groomerData
      .sort((a, b) => b.discounts - a.discounts)
      .map(g => ({
        dimensionValue: g.name,
        drillKey: `groomer:${g.name}`,
        metrics: {
          discounts: g.discounts,
          appointments: g.appointments,
          avgDiscount: g.avgDiscount,
          discountRate: g.discountRate,
          revenue: g.revenue,
        },
      }))
  }, [groomerData])

  // Chart data
  const chartData = useMemo(() => {
    return groomerData
      .sort((a, b) => b.discounts - a.discounts)
      .map(g => ({
        label: g.name,
        value: g.discounts,
      }))
  }, [groomerData])

  if (isLoading) {
    return (
      <ReportShell title="Groomers Discounts" description="Discount tracking by groomer" defaultTimeBasis="checkout">
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
      <ReportShell title="Groomers Discounts" description="Discount tracking by groomer" defaultTimeBasis="checkout">
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
      <ReportShell title="Groomers Discounts" description="Discount tracking by groomer" defaultTimeBasis="checkout">
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
        title="Groomers Discounts"
        description="Track discounts given by each groomer"
        defaultTimeBasis="checkout"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Discounts by Groomer" description="Total discounts given" ariaLabel="Bar chart of discounts by groomer">
          <SimpleBarChart data={chartData} height={280} formatValue={formatMoney} />
        </ChartCard>

        <DataTable
          title="Groomer Discount Details"
          data={tableData}
          columns={[
            { id: 'discounts', label: 'Total Discounts', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'appointments', label: 'Appointments', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgDiscount', label: 'Avg Discount', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'discountRate', label: 'Discount Rate', format: 'percent', align: 'right', sortable: true },
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
