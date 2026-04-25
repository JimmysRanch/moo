/**
 * Breed + Weight Class Overview Report
 * Volume share and pacing for every size/breed pairing
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

function getWeightClass(weightLbs: number | undefined): string {
  if (!weightLbs) return 'Unknown'
  if (weightLbs <= 20) return 'Small'
  if (weightLbs <= 50) return 'Medium'
  if (weightLbs <= 80) return 'Large'
  return 'X-Large'
}

export function BreedWeightClassOverview() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate breed/weight class combinations
  const combinationData = useMemo(() => {
    const combos: Record<string, { count: number; revenue: number; avgDuration: number }> = {}
    let totalCount = 0

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      totalCount++
      
      const breed = appt.petBreed || 'Unknown'
      const weightClass = getWeightClass(appt.petWeight)
      const key = `${weightClass} - ${breed}`
      
      if (!combos[key]) {
        combos[key] = { count: 0, revenue: 0, avgDuration: 0 }
      }
      combos[key].count += 1
      combos[key].revenue += appt.netCents || 0
      combos[key].avgDuration += appt.durationMinutes || 60
    })

    return Object.entries(combos).map(([combo, data]) => ({
      combo,
      count: data.count,
      revenue: data.revenue,
      avgDuration: data.count > 0 ? Math.round(data.avgDuration / data.count) : 0,
      share: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
      avgTicket: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
    }))
  }, [appointments])

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = combinationData.reduce((sum, c) => sum + c.revenue, 0)
    const totalCount = combinationData.reduce((sum, c) => sum + c.count, 0)
    const uniqueCombos = combinationData.length
    const topCombo = combinationData.sort((a, b) => b.count - a.count)[0]

    return [
      { metricId: 'totalRevenue', value: { current: totalRevenue, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'totalAppointments', value: { current: totalCount, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'uniqueCombinations', value: { current: uniqueCombos, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'topComboCount', value: { current: topCombo?.count || 0, delta: 0, deltaPercent: 0, format: 'number' as const } },
    ]
  }, [combinationData])

  // Table data
  const tableData = useMemo(() => {
    return combinationData
      .sort((a, b) => b.count - a.count)
      .map(c => ({
        dimensionValue: c.combo,
        drillKey: `combo:${c.combo}`,
        metrics: {
          appointments: c.count,
          revenue: c.revenue,
          avgDuration: c.avgDuration,
          share: c.share,
          avgTicket: c.avgTicket,
        },
      }))
  }, [combinationData])

  if (isLoading) {
    return (
      <ReportShell title="Breed + Weight Class Overview" description="Size/breed combinations" defaultTimeBasis="service">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-3"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-24" /></Card>
            ))}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Breed + Weight Class Overview" description="Size/breed combinations" defaultTimeBasis="service">
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
      <ReportShell title="Breed + Weight Class Overview" description="Size/breed combinations" defaultTimeBasis="service">
        <Card className="p-8 text-center">
          <Info size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Data</h2>
          <p className="text-muted-foreground mb-4">No completed appointments found.</p>
          <Button variant="outline" onClick={() => setFilters({ ...filters, dateRange: 'last90' })}>Try Last 90 Days</Button>
        </Card>
      </ReportShell>
    )
  }

  return (
    <>
      <ReportShell
        title="Breed + Weight Class Overview"
        description="Volume share and pacing for every size/breed pairing"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <DataTable
          title="Size/Breed Combinations"
          data={tableData}
          columns={[
            { id: 'appointments', label: 'Appointments', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgDuration', label: 'Avg Duration (min)', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'share', label: 'Volume Share %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={20}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
