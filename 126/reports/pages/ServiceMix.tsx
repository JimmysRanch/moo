/**
 * Service Mix Report
 * Revenue share by top grooming services and add-ons
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
  measurePerformance 
} from '../engine/analyticsEngine'

export function ServiceMix() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate service mix
  const serviceData = useMemo(() => {
    return measurePerformance('aggregateServiceMix', () => {
      const services: Record<string, { revenue: number; count: number; category: string }> = {}
      
      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        appt.services.forEach((svc) => {
          const name = svc.name || 'Unknown'
          if (!services[name]) {
            services[name] = { revenue: 0, count: 0, category: svc.category || 'Service' }
          }
          services[name].revenue += svc.priceCents
          services[name].count += 1
        })
      })

      const total = Object.values(services).reduce((sum, s) => sum + s.revenue, 0)

      return Object.entries(services).map(([name, data]) => ({
        name,
        revenue: data.revenue,
        count: data.count,
        category: data.category,
        share: total > 0 ? (data.revenue / total) * 100 : 0,
        avgPrice: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
      }))
    })
  }, [appointments])

  // Calculate previous period service revenue for comparison
  const previousServiceRevenue = useMemo(() => {
    return measurePerformance('calculatePreviousServiceRevenue', () => {
      let total = 0
      previousAppointments.filter(a => a.status === 'picked_up').forEach(appt => {
        appt.services.forEach((svc) => {
          total += svc.priceCents
        })
      })
      return total
    })
  }, [previousAppointments])

  // KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateServiceMixKPIs', () => {
      const currentTotalRevenue = serviceData.reduce((sum, s) => sum + s.revenue, 0)
      const uniqueServices = serviceData.length

      return [
        { metricId: 'totalRevenue', value: calculateKPIWithDelta(currentTotalRevenue, previousServiceRevenue, 'money') },
        { metricId: 'uniqueServices', value: calculateKPIWithDelta(uniqueServices, 0, 'number') },
        { metricId: 'avgServicePrice', value: calculateKPIWithDelta(
          serviceData.length > 0 ? Math.round(currentTotalRevenue / serviceData.reduce((sum, s) => sum + s.count, 0)) : 0,
          0,
          'money'
        ) },
        { metricId: 'topServiceShare', value: calculateKPIWithDelta(
          [...serviceData].sort((a, b) => b.revenue - a.revenue)[0]?.share || 0,
          0,
          'percent'
        ) },
      ]
    })
  }, [appointments.length, serviceData, previousServiceRevenue])

  // Table data
  const tableData = useMemo(() => {
    return serviceData
      .sort((a, b) => b.revenue - a.revenue)
      .map(s => ({
        dimensionValue: s.name,
        drillKey: `service:${s.name}`,
        metrics: {
          revenue: s.revenue,
          timesSold: s.count,
          share: s.share,
          avgPrice: s.avgPrice,
          type: s.category === 'Add-On' ? 'Add-On' : 'Core',
        },
      }))
  }, [serviceData])

  // Chart data
  const pieData = useMemo(() => {
    return serviceData
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map(s => ({
        label: s.name,
        value: s.revenue,
      }))
  }, [serviceData])

  if (isLoading) {
    return (
      <ReportShell title="Service Mix" description="Revenue by service type" defaultTimeBasis="service">
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
      <ReportShell title="Service Mix" description="Revenue by service type" defaultTimeBasis="service">
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
      <ReportShell title="Service Mix" description="Revenue by service type" defaultTimeBasis="service">
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
        title="Service Mix"
        description="Revenue share by top grooming services and add-ons"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Revenue by Service" description="Top services by revenue" ariaLabel="Pie chart of service revenue">
          <SimplePieChart data={pieData} height={280} formatValue={formatMoney} />
        </ChartCard>

        <DataTable
          title="Service Details"
          data={tableData}
          columns={[
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'timesSold', label: 'Times Sold', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'share', label: 'Share %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgPrice', label: 'Avg Price', format: 'money', align: 'right', sortable: true },
            { id: 'type', label: 'Type', format: 'text', align: 'left', sortable: true },
          ]}
          maxPreviewRows={15}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
