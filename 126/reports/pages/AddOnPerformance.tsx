/**
 * Add-On Performance Report
 * Track add-on service revenue and attachment rates
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
  calculateKPIWithDelta, 
  measurePerformance 
} from '../engine/analyticsEngine'

export function AddOnPerformance() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate add-on metrics
  const addOnData = useMemo(() => {
    return measurePerformance('aggregateAddOnPerformance', () => {
      const addOns: Record<string, { revenue: number; count: number; appointments: Set<string> }> = {}
      let totalAppointments = 0

      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        totalAppointments++
        
        // Check for add-ons in the services array
        if (appt.addOns && appt.addOns.length > 0) {
          appt.addOns.forEach((addOn) => {
            if (!addOns[addOn.name]) {
              addOns[addOn.name] = { revenue: 0, count: 0, appointments: new Set() }
            }
            addOns[addOn.name].revenue += addOn.priceCents
            addOns[addOn.name].count += 1
            addOns[addOn.name].appointments.add(appt.id)
          })
        }
      })

      return {
        addOns: Object.entries(addOns).map(([name, data]) => ({
          name,
          revenue: data.revenue,
          count: data.count,
          appointmentCount: data.appointments.size,
          attachRate: totalAppointments > 0 ? (data.appointments.size / totalAppointments) * 100 : 0,
        })),
        totalAppointments,
      }
    })
  }, [appointments])

  // Calculate previous period add-on revenue
  const previousAddOnRevenue = useMemo(() => {
    return measurePerformance('calculatePreviousAddOnRevenue', () => {
      let total = 0
      previousAppointments.filter(a => a.status === 'picked_up').forEach(appt => {
        if (appt.addOns && appt.addOns.length > 0) {
          appt.addOns.forEach((addOn) => {
            total += addOn.priceCents
          })
        }
      })
      return total
    })
  }, [previousAppointments])

  // KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateAddOnKPIs', () => {
      const currentTotalRevenue = addOnData.addOns.reduce((sum, a) => sum + a.revenue, 0)
      const totalCount = addOnData.addOns.reduce((sum, a) => sum + a.count, 0)
      
      // Calculate unique appointments with add-ons using a Set to avoid double-counting
      const appointmentsWithAddOns = new Set<string>()
      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        if (appt.addOns && appt.addOns.length > 0) {
          appointmentsWithAddOns.add(appt.id)
        }
      })
      const attachRate = addOnData.totalAppointments > 0 ? (appointmentsWithAddOns.size / addOnData.totalAppointments) * 100 : 0

      return [
        { metricId: 'addOnRevenue', value: calculateKPIWithDelta(currentTotalRevenue, previousAddOnRevenue, 'money') },
        { metricId: 'addOnCount', value: calculateKPIWithDelta(totalCount, 0, 'number') },
        { metricId: 'attachRate', value: calculateKPIWithDelta(attachRate, 0, 'percent') },
        { metricId: 'uniqueAddOns', value: calculateKPIWithDelta(addOnData.addOns.length, 0, 'number') },
      ]
    })
  }, [addOnData, previousAddOnRevenue, appointments])

  // Table data
  const tableData = useMemo(() => {
    return addOnData.addOns
      .sort((a, b) => b.revenue - a.revenue)
      .map(addon => ({
        dimensionValue: addon.name,
        drillKey: `addon:${addon.name}`,
        metrics: {
          revenue: addon.revenue,
          count: addon.count,
          attachRate: addon.attachRate,
          avgPrice: addon.count > 0 ? Math.round(addon.revenue / addon.count) : 0,
        },
      }))
  }, [addOnData])

  // Chart data
  const chartData = useMemo(() => {
    return addOnData.addOns
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(addon => ({
        label: addon.name,
        value: addon.revenue,
      }))
  }, [addOnData])

  if (isLoading) {
    return (
      <ReportShell title="Add-On Performance" description="Add-on revenue and attachment rates" defaultTimeBasis="service">
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
      <ReportShell title="Add-On Performance" description="Add-on revenue and attachment rates" defaultTimeBasis="service">
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
      <ReportShell title="Add-On Performance" description="Add-on revenue and attachment rates" defaultTimeBasis="service">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <p className="text-muted-foreground mb-4">No add-on data found.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  const formatMoney = (v: number) => `$${(v / 100).toLocaleString()}`

  return (
    <>
      <ReportShell
        title="Add-On Performance"
        description="Track add-on service revenue and attachment rates"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Top Add-Ons by Revenue" description="Highest performing add-on services" ariaLabel="Bar chart of add-on revenue">
          <SimpleBarChart data={chartData} height={280} formatValue={formatMoney} />
        </ChartCard>

        <DataTable
          title="Add-On Details"
          data={tableData}
          columns={[
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'count', label: 'Times Sold', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'attachRate', label: 'Attach Rate', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgPrice', label: 'Avg Price', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={10}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
