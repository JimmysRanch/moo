/**
 * Revenue by Weight Class Report
 * Total sales, tips, and ticket mix by dog size
 */

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Info, ArrowsClockwise } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { ChartCard, SimplePieChart, SimpleBarChart } from '../components/ChartCard'
import { DataTable } from '../components/DataTable'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData } from '../hooks/useReportData'
import { getWeightCategoryLabel } from '@/lib/types'
import { 
  calculateNetSales, 
  calculateTotalTips,
  calculateAppointmentsCompleted,
  calculateAverageTicket,
  calculateKPIWithDelta, 
  measurePerformance 
} from '../engine/analyticsEngine'

export function RevenueByWeightClass() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate metrics by weight class
  const weightClassData = useMemo(() => {
    return measurePerformance('aggregateRevenueByWeightClass', () => {
      const byClass: Record<string, { revenue: number; tips: number; count: number }> = {}

      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        const weightClass = appt.petWeightCategory ? getWeightCategoryLabel(appt.petWeightCategory) : 'Unknown'
        
        if (!byClass[weightClass]) {
          byClass[weightClass] = { revenue: 0, tips: 0, count: 0 }
        }
        byClass[weightClass].revenue += appt.netCents
        byClass[weightClass].tips += appt.tipCents
        byClass[weightClass].count += 1
      })

      const total = Object.values(byClass).reduce((sum, c) => sum + c.revenue, 0)

      return Object.entries(byClass).map(([weightClass, data]) => ({
        weightClass,
        revenue: data.revenue,
        tips: data.tips,
        count: data.count,
        share: total > 0 ? (data.revenue / total) * 100 : 0,
        avgTicket: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
      }))
    })
  }, [appointments])

  // KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateRevenueByWeightClassKPIs', () => {
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
        { metricId: 'totalAppointments', value: calculateKPIWithDelta(currentApptsCompleted, previousApptsCompleted, 'number') },
        { metricId: 'avgTicket', value: calculateKPIWithDelta(currentAvgTicket, previousAvgTicket, 'money') },
      ]
    })
  }, [appointments, previousAppointments])

  // Table data
  const tableData = useMemo(() => {
    return weightClassData
      .sort((a, b) => b.revenue - a.revenue)
      .map(wc => ({
        dimensionValue: wc.weightClass,
        drillKey: `weightClass:${wc.weightClass}`,
        metrics: {
          revenue: wc.revenue,
          tips: wc.tips,
          appointments: wc.count,
          share: wc.share,
          avgTicket: wc.avgTicket,
        },
      }))
  }, [weightClassData])

  // Chart data
  const pieData = useMemo(() => {
    return weightClassData.map(wc => ({
      label: wc.weightClass,
      value: wc.revenue,
    }))
  }, [weightClassData])

  const barData = useMemo(() => {
    return weightClassData.map(wc => ({
      label: wc.weightClass.split(' ')[0], // Just the size name
      value: wc.avgTicket,
    }))
  }, [weightClassData])

  if (isLoading) {
    return (
      <ReportShell title="Revenue by Weight Class" description="Revenue by dog size" defaultTimeBasis="service">
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
      <ReportShell title="Revenue by Weight Class" description="Revenue by dog size" defaultTimeBasis="service">
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
      <ReportShell title="Revenue by Weight Class" description="Revenue by dog size" defaultTimeBasis="service">
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
        title="Revenue by Weight Class"
        description="Total sales, tips, and ticket mix by dog size"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Revenue Share by Size" description="Revenue distribution by weight class" ariaLabel="Pie chart of revenue by weight class">
            <SimplePieChart data={pieData} height={280} formatValue={formatMoney} />
          </ChartCard>

          <ChartCard title="Average Ticket by Size" description="Average ticket value by weight class" ariaLabel="Bar chart of average ticket by weight class">
            <SimpleBarChart data={barData} height={280} formatValue={formatMoney} />
          </ChartCard>
        </div>

        <DataTable
          title="Weight Class Details"
          data={tableData}
          columns={[
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tips', label: 'Tips', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'appointments', label: 'Appointments', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'share', label: 'Share %', format: 'percent', align: 'right', sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', defaultVisible: true, sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
