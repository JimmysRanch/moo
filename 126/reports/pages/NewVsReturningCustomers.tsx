/**
 * New vs Returning Customers Report
 * Compare new and returning customer metrics
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
import { 
  calculateKPIWithDelta, 
  measurePerformance,
  getDateRange,
} from '../engine/analyticsEngine'

export function NewVsReturningCustomers() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate new vs returning metrics
  const customerData = useMemo(() => {
    return measurePerformance('calculateNewVsReturning', () => {
      const clientStats: Record<string, { visits: number; revenue: number; firstVisit: string; clientName: string }> = {}
      
      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        if (!clientStats[appt.clientId]) {
          clientStats[appt.clientId] = { visits: 0, revenue: 0, firstVisit: appt.serviceDate, clientName: appt.clientName }
        }
        clientStats[appt.clientId].visits += 1
        clientStats[appt.clientId].revenue += appt.netCents
        if (appt.serviceDate < clientStats[appt.clientId].firstVisit) {
          clientStats[appt.clientId].firstVisit = appt.serviceDate
        }
      })

      // Determine if client is new (first visit in period) or returning
      const { start } = getDateRange(filters)
      let newCount = 0, returningCount = 0
      let newRevenue = 0, returningRevenue = 0

      Object.values(clientStats).forEach(stats => {
        const firstVisitDate = new Date(stats.firstVisit)
        if (firstVisitDate >= start) {
          newCount++
          newRevenue += stats.revenue
        } else {
          returningCount++
          returningRevenue += stats.revenue
        }
      })

      return {
        newCount,
        returningCount,
        newRevenue,
        returningRevenue,
        totalClients: newCount + returningCount,
        newPercentage: (newCount + returningCount) > 0 ? (newCount / (newCount + returningCount)) * 100 : 0,
      }
    })
  }, [appointments, filters])

  // Calculate previous period data for comparison
  const previousCustomerData = useMemo(() => {
    return measurePerformance('calculatePreviousNewVsReturning', () => {
      const clientStats: Record<string, { visits: number; revenue: number; firstVisit: string }> = {}
      
      previousAppointments.filter(a => a.status === 'picked_up').forEach(appt => {
        if (!clientStats[appt.clientId]) {
          clientStats[appt.clientId] = { visits: 0, revenue: 0, firstVisit: appt.serviceDate }
        }
        clientStats[appt.clientId].visits += 1
        clientStats[appt.clientId].revenue += appt.netCents
        if (appt.serviceDate < clientStats[appt.clientId].firstVisit) {
          clientStats[appt.clientId].firstVisit = appt.serviceDate
        }
      })

      let newCount = 0, returningCount = 0
      let newRevenue = 0, returningRevenue = 0

      // Use a similar logic but for previous period data
      Object.values(clientStats).forEach(stats => {
        if (stats.visits === 1) {
          newCount++
          newRevenue += stats.revenue
        } else {
          returningCount++
          returningRevenue += stats.revenue
        }
      })

      return { newCount, returningCount, newRevenue, returningRevenue }
    })
  }, [previousAppointments])

  // KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return [
      { metricId: 'newCustomers', value: calculateKPIWithDelta(customerData.newCount, previousCustomerData.newCount, 'number') },
      { metricId: 'returningCustomers', value: calculateKPIWithDelta(customerData.returningCount, previousCustomerData.returningCount, 'number') },
      { metricId: 'newRevenue', value: calculateKPIWithDelta(customerData.newRevenue, previousCustomerData.newRevenue, 'money') },
      { metricId: 'returningRevenue', value: calculateKPIWithDelta(customerData.returningRevenue, previousCustomerData.returningRevenue, 'money') },
    ]
  }, [appointments.length, customerData, previousCustomerData])

  // Chart data
  const pieData = useMemo(() => {
    return [
      { label: 'New Customers', value: customerData.newCount },
      { label: 'Returning Customers', value: customerData.returningCount },
    ]
  }, [customerData])

  const revenueData = useMemo(() => {
    return [
      { label: 'New', value: customerData.newRevenue },
      { label: 'Returning', value: customerData.returningRevenue },
    ]
  }, [customerData])

  // Table data
  const tableData = useMemo(() => {
    return [
      {
        dimensionValue: 'New Customers',
        drillKey: 'type:new',
        metrics: {
          count: customerData.newCount,
          revenue: customerData.newRevenue,
          avgRevenue: customerData.newCount > 0 ? Math.round(customerData.newRevenue / customerData.newCount) : 0,
          share: customerData.totalClients > 0 ? (customerData.newCount / customerData.totalClients) * 100 : 0,
        },
      },
      {
        dimensionValue: 'Returning Customers',
        drillKey: 'type:returning',
        metrics: {
          count: customerData.returningCount,
          revenue: customerData.returningRevenue,
          avgRevenue: customerData.returningCount > 0 ? Math.round(customerData.returningRevenue / customerData.returningCount) : 0,
          share: customerData.totalClients > 0 ? (customerData.returningCount / customerData.totalClients) * 100 : 0,
        },
      },
    ]
  }, [customerData])

  if (isLoading) {
    return (
      <ReportShell title="New vs Returning Customers" description="Customer acquisition analysis" defaultTimeBasis="service">
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
      <ReportShell title="New vs Returning Customers" description="Customer acquisition analysis" defaultTimeBasis="service">
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
      <ReportShell title="New vs Returning Customers" description="Customer acquisition analysis" defaultTimeBasis="service">
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
        title="New vs Returning Customers"
        description="Compare new and returning customer metrics"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Customer Distribution" description="New vs returning customers" ariaLabel="Pie chart of customer types">
            <SimplePieChart data={pieData} height={280} formatValue={(v) => v.toString()} />
          </ChartCard>

          <ChartCard title="Revenue by Customer Type" description="Revenue comparison" ariaLabel="Bar chart of revenue by customer type">
            <SimpleBarChart data={revenueData} height={280} formatValue={formatMoney} />
          </ChartCard>
        </div>

        <DataTable
          title="Customer Type Summary"
          data={tableData}
          columns={[
            { id: 'count', label: 'Customers', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgRevenue', label: 'Avg Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'share', label: 'Share %', format: 'percent', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
