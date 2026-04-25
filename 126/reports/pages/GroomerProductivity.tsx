/**
 * Groomer Productivity Report
 * Utilization, ticket size, and rebook rate by team member
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
import { 
  calculateNetSales, 
  calculateAppointmentsCompleted,
  calculateAverageTicket,
  calculateRebook7d,
  calculateKPIWithDelta, 
  measurePerformance 
} from '../engine/analyticsEngine'

export function GroomerProductivity() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    staff, 
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate groomer productivity
  const groomerData = useMemo(() => {
    return measurePerformance('aggregateGroomerProductivity', () => {
      const byGroomer: Record<string, { 
        appointments: number
        hours: number
        revenue: number
        rebooks: number
        clients: Set<string>
      }> = {}

      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        const groomerName = appt.groomerName || 'Unassigned'
        
        if (!byGroomer[groomerName]) {
          byGroomer[groomerName] = { appointments: 0, hours: 0, revenue: 0, rebooks: 0, clients: new Set() }
        }
        
        byGroomer[groomerName].appointments += 1
        byGroomer[groomerName].hours += appt.actualDurationMinutes ? appt.actualDurationMinutes / 60 : appt.scheduledDurationMinutes / 60
        byGroomer[groomerName].revenue += appt.netCents
        if (appt.rebookedWithin7d) byGroomer[groomerName].rebooks += 1
        byGroomer[groomerName].clients.add(appt.clientId)
      })

      // Calculate available hours (estimate based on date range)
      const daysInPeriod = 30 // Can be improved based on actual filter date range
      const availableHoursPerGroomer = daysInPeriod * 0.7 * 8 // 70% of days working, 8 hours

      return Object.entries(byGroomer).map(([name, data]) => {
        const groomer = staff.find(s => s.name === name)
        return {
          name,
          role: groomer?.role || 'Groomer',
          appointments: data.appointments,
          hours: Math.round(data.hours * 10) / 10,
          utilization: availableHoursPerGroomer > 0 ? (data.hours / availableHoursPerGroomer) * 100 : 0,
          avgTicket: data.appointments > 0 ? Math.round(data.revenue / data.appointments) : 0,
          rebookRate: data.appointments > 0 ? (data.rebooks / data.appointments) * 100 : 0,
          revenue: data.revenue,
          uniqueClients: data.clients.size,
        }
      })
    })
  }, [appointments, staff])

  // KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateGroomerProductivityKPIs', () => {
      const currentApptsCompleted = calculateAppointmentsCompleted(appointments)
      const previousApptsCompleted = calculateAppointmentsCompleted(previousAppointments)
      
      const currentRevenue = calculateNetSales(appointments)
      const previousRevenue = calculateNetSales(previousAppointments)
      
      const currentAvgTicket = calculateAverageTicket(appointments)
      const previousAvgTicket = calculateAverageTicket(previousAppointments)
      
      const currentRebook = calculateRebook7d(appointments)
      const previousRebook = calculateRebook7d(previousAppointments)

      return [
        { metricId: 'totalAppointments', value: calculateKPIWithDelta(currentApptsCompleted, previousApptsCompleted, 'number') },
        { metricId: 'totalRevenue', value: calculateKPIWithDelta(currentRevenue, previousRevenue, 'money') },
        { metricId: 'avgTicket', value: calculateKPIWithDelta(currentAvgTicket, previousAvgTicket, 'money') },
        { metricId: 'avgRebookRate', value: calculateKPIWithDelta(currentRebook, previousRebook, 'percent') },
      ]
    })
  }, [appointments, previousAppointments])

  // Chart data
  const chartData = useMemo(() => {
    return groomerData
      .sort((a, b) => b.revenue - a.revenue)
      .map(g => ({
        label: g.name,
        value: g.avgTicket,
      }))
  }, [groomerData])

  // Table data
  const tableData = useMemo(() => {
    return groomerData
      .sort((a, b) => b.revenue - a.revenue)
      .map(g => ({
        dimensionValue: g.name,
        drillKey: `groomer:${g.name}`,
        metrics: {
          role: g.role,
          appointments: g.appointments,
          hours: g.hours,
          utilization: g.utilization,
          avgTicket: g.avgTicket,
          uniqueClients: g.uniqueClients,
          rebookRate: g.rebookRate,
        },
      }))
  }, [groomerData])

  if (isLoading) {
    return (
      <ReportShell title="Groomer Productivity" description="Team performance" defaultTimeBasis="service">
        <Skeleton className="h-[400px]" />
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Groomer Productivity" description="Team performance" defaultTimeBasis="service">
        <Alert variant="destructive"><AlertDescription>Failed to load data.</AlertDescription></Alert>
        <Button onClick={() => window.location.reload()} className="mt-4"><ArrowsClockwise className="mr-2 h-4 w-4" /> Retry</Button>
      </ReportShell>
    )
  }

  if (appointments.length === 0) {
    return (
      <ReportShell title="Groomer Productivity" description="Team performance" defaultTimeBasis="service">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`

  return (
    <>
      <ReportShell title="Groomer Productivity" description="Utilization, ticket size, and rebook rate by team member" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <KPIDeck metrics={kpis} />

        <ChartCard title="Average Ticket by Groomer" description="Performance comparison" ariaLabel="Bar chart of average ticket by groomer">
          <SimpleBarChart data={chartData} height={280} formatValue={formatMoney} />
        </ChartCard>

        <DataTable
          title="Team Member Performance"
          data={tableData}
          columns={[
            { id: 'role', label: 'Role', format: 'text', align: 'left', sortable: true },
            { id: 'appointments', label: 'Appts', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'hours', label: 'Hours', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'utilization', label: 'Utilization', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'uniqueClients', label: 'Clients', format: 'number', align: 'right', sortable: true },
            { id: 'rebookRate', label: 'Rebook Rate', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>
      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
