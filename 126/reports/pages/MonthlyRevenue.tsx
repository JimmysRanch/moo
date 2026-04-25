/**
 * Monthly Revenue Report
 * Month-over-month revenue performance
 */

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Info, ArrowsClockwise } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { ChartCard, SimpleLineChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData } from '../hooks/useReportData'
import { 
  calculateNetSales, 
  calculateTotalTips,
  calculateAppointmentsCompleted,
  calculateAverageTicket,
  calculateKPIWithDelta, 
  measurePerformance 
} from '../engine/analyticsEngine'

export function MonthlyRevenue() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate monthly data
  const monthlyData = useMemo(() => {
    return measurePerformance('aggregateMonthlyRevenue', () => {
      const byMonth: Record<string, { revenue: number; appointments: number; tips: number }> = {}

      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        const monthKey = appt.serviceDate.substring(0, 7) // YYYY-MM format
        
        if (!byMonth[monthKey]) {
          byMonth[monthKey] = { revenue: 0, appointments: 0, tips: 0 }
        }
        byMonth[monthKey].revenue += appt.netCents
        byMonth[monthKey].appointments += 1
        byMonth[monthKey].tips += appt.tipCents
      })

      return Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          label: month,
          value: data.revenue,
          appointments: data.appointments,
          tips: data.tips,
        }))
    })
  }, [appointments])

  // KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateMonthlyRevenueKPIs', () => {
      const currentRevenue = calculateNetSales(appointments)
      const previousRevenue = calculateNetSales(previousAppointments)
      
      const currentTips = calculateTotalTips(appointments)
      const previousTips = calculateTotalTips(previousAppointments)
      
      const currentApptsCompleted = calculateAppointmentsCompleted(appointments)
      const previousApptsCompleted = calculateAppointmentsCompleted(previousAppointments)
      
      const currentAvgTicket = calculateAverageTicket(appointments)
      const previousAvgTicket = calculateAverageTicket(previousAppointments)

      return [
        { metricId: 'totalRevenue', value: calculateKPIWithDelta(currentRevenue, previousRevenue, 'money') },
        { metricId: 'totalTips', value: calculateKPIWithDelta(currentTips, previousTips, 'money') },
        { metricId: 'appointments', value: calculateKPIWithDelta(currentApptsCompleted, previousApptsCompleted, 'number') },
        { metricId: 'avgTicket', value: calculateKPIWithDelta(currentAvgTicket, previousAvgTicket, 'money') },
      ]
    })
  }, [appointments, previousAppointments])

  // Table data
  const tableData = useMemo(() => {
    return monthlyData.map(m => ({
      dimensionValue: m.label,
      drillKey: `month:${m.label}`,
      metrics: {
        revenue: m.value,
        appointments: m.appointments,
        tips: m.tips,
        avgTicket: m.appointments > 0 ? Math.round(m.value / m.appointments) : 0,
      },
    }))
  }, [monthlyData])

  // Chart data
  const chartData = useMemo(() => {
    return monthlyData.map(m => ({
      label: m.label,
      value: m.value,
    }))
  }, [monthlyData])

  if (isLoading) {
    return (
      <ReportShell title="Monthly Revenue" description="Month-over-month performance" defaultTimeBasis="service">
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
      <ReportShell title="Monthly Revenue" description="Month-over-month performance" defaultTimeBasis="service">
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
      <ReportShell title="Monthly Revenue" description="Month-over-month performance" defaultTimeBasis="service">
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
        title="Monthly Revenue"
        description="Month-over-month revenue performance with retail contribution"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Revenue Trend" description="Monthly revenue over time" ariaLabel="Line chart of monthly revenue">
          <SimpleLineChart data={chartData} height={280} formatValue={formatMoney} showArea />
        </ChartCard>

        <DataTable
          title="Monthly Breakdown"
          data={tableData}
          columns={[
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'appointments', label: 'Appointments', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tips', label: 'Tips', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={12}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
