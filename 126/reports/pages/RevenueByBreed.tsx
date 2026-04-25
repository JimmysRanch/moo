/**
 * Revenue by Breed Report
 * Top-earning breeds with time-on-site context
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

export function RevenueByBreed() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate metrics by breed
  const breedData = useMemo(() => {
    const byBreed: Record<string, { revenue: number; count: number; duration: number; tips: number }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const breed = appt.petBreed || 'Unknown'
      
      if (!byBreed[breed]) {
        byBreed[breed] = { revenue: 0, count: 0, duration: 0, tips: 0 }
      }
      byBreed[breed].revenue += appt.netCents || 0
      byBreed[breed].count += 1
      byBreed[breed].duration += appt.durationMinutes || 60
      byBreed[breed].tips += appt.tipCents || 0
    })

    const total = Object.values(byBreed).reduce((sum, b) => sum + b.revenue, 0)

    return Object.entries(byBreed).map(([breed, data]) => ({
      breed,
      revenue: data.revenue,
      count: data.count,
      avgDuration: data.count > 0 ? Math.round(data.duration / data.count) : 0,
      tips: data.tips,
      share: total > 0 ? (data.revenue / total) * 100 : 0,
      avgTicket: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
    }))
  }, [appointments])

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = breedData.reduce((sum, b) => sum + b.revenue, 0)
    const totalCount = breedData.reduce((sum, b) => sum + b.count, 0)
    const uniqueBreeds = breedData.length
    const topBreed = breedData.sort((a, b) => b.revenue - a.revenue)[0]

    return [
      { metricId: 'totalRevenue', value: { current: totalRevenue, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'totalAppointments', value: { current: totalCount, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'uniqueBreeds', value: { current: uniqueBreeds, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'topBreedRevenue', value: { current: topBreed?.revenue || 0, delta: 0, deltaPercent: 0, format: 'money' as const } },
    ]
  }, [breedData])

  // Table data
  const tableData = useMemo(() => {
    return breedData
      .sort((a, b) => b.revenue - a.revenue)
      .map(b => ({
        dimensionValue: b.breed,
        drillKey: `breed:${b.breed}`,
        metrics: {
          revenue: b.revenue,
          appointments: b.count,
          avgDuration: b.avgDuration,
          tips: b.tips,
          share: b.share,
          avgTicket: b.avgTicket,
        },
      }))
  }, [breedData])

  // Chart data - top 10 breeds
  const chartData = useMemo(() => {
    return breedData
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(b => ({
        label: b.breed.length > 15 ? b.breed.substring(0, 12) + '...' : b.breed,
        value: b.revenue,
      }))
  }, [breedData])

  if (isLoading) {
    return (
      <ReportShell title="Revenue by Breed" description="Top-earning breeds" defaultTimeBasis="service">
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
      <ReportShell title="Revenue by Breed" description="Top-earning breeds" defaultTimeBasis="service">
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
      <ReportShell title="Revenue by Breed" description="Top-earning breeds" defaultTimeBasis="service">
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
        title="Revenue by Breed"
        description="Top-earning breeds with time-on-site context"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Top 10 Breeds by Revenue" description="Highest-earning dog breeds" ariaLabel="Bar chart of revenue by breed">
          <SimpleBarChart data={chartData} height={280} formatValue={formatMoney} />
        </ChartCard>

        <DataTable
          title="Breed Revenue Details"
          data={tableData}
          columns={[
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'appointments', label: 'Appointments', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgDuration', label: 'Avg Duration (min)', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'tips', label: 'Tips', format: 'money', align: 'right', sortable: true },
            { id: 'share', label: 'Share %', format: 'percent', align: 'right', sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={15}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
