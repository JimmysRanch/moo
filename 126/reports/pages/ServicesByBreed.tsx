/**
 * Services by Breed Report
 * Service distribution by breed
 */

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Info, ArrowsClockwise } from '@phosphor-icons/react'
import { ReportShell } from '../components/ReportShell'
import { KPIDeck } from '../components/KPICard'
import { DataTable } from '../components/DataTable'
import { DefinitionsModal } from '../components/DefinitionsModal'
import { useReportFilters } from '../hooks/useReportFilters'
import { useReportData } from '../hooks/useReportData'

export function ServicesByBreed() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate services by breed
  const serviceData = useMemo(() => {
    const byCombo: Record<string, { count: number; revenue: number }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const breed = appt.petBreed || 'Unknown'
      
      appt.services?.forEach((svc) => {
        const key = `${breed} - ${svc.name || 'Unknown'}`
        if (!byCombo[key]) {
          byCombo[key] = { count: 0, revenue: 0 }
        }
        byCombo[key].count += 1
        byCombo[key].revenue += svc.priceCents || 0
      })
    })

    return Object.entries(byCombo).map(([combo, data]) => ({
      combo,
      count: data.count,
      revenue: data.revenue,
      avgPrice: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
    }))
  }, [appointments])

  // KPIs
  const kpis = useMemo(() => {
    const totalServices = serviceData.reduce((sum, s) => sum + s.count, 0)
    const totalRevenue = serviceData.reduce((sum, s) => sum + s.revenue, 0)

    return [
      { metricId: 'totalServices', value: { current: totalServices, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'totalRevenue', value: { current: totalRevenue, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'uniqueCombos', value: { current: serviceData.length, delta: 0, deltaPercent: 0, format: 'number' as const } },
    ]
  }, [serviceData])

  // Table data
  const tableData = useMemo(() => {
    return serviceData
      .sort((a, b) => b.count - a.count)
      .map(s => ({
        dimensionValue: s.combo,
        drillKey: `combo:${s.combo}`,
        metrics: {
          count: s.count,
          revenue: s.revenue,
          avgPrice: s.avgPrice,
        },
      }))
  }, [serviceData])

  if (isLoading) {
    return (
      <ReportShell title="Services by Breed" description="Service by breed" defaultTimeBasis="service">
        <Skeleton className="h-[400px]" />
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Services by Breed" description="Service by breed" defaultTimeBasis="service">
        <Alert variant="destructive"><AlertDescription>Failed to load data.</AlertDescription></Alert>
        <Button onClick={() => window.location.reload()} className="mt-4"><ArrowsClockwise className="mr-2 h-4 w-4" /> Retry</Button>
      </ReportShell>
    )
  }

  if (appointments.length === 0) {
    return (
      <ReportShell title="Services by Breed" description="Service by breed" defaultTimeBasis="service">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell title="Services by Breed" description="Service distribution by breed" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <KPIDeck metrics={kpis} />
        <DataTable
          title="Service/Breed Combinations"
          data={tableData}
          columns={[
            { id: 'count', label: 'Times Sold', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgPrice', label: 'Avg Price', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={20}
          showViewAll
        />
      </ReportShell>
      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
