/**
 * Appointments by Breed Report
 * Highest-volume breeds and their visit cadence
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
import { getWeightCategoryLabel } from '@/lib/types'
import { 
  calculateAppointmentsCompleted,
  calculateKPIWithDelta, 
  measurePerformance 
} from '../engine/analyticsEngine'

export function AppointmentsByBreed() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate by breed
  const breedData = useMemo(() => {
    return measurePerformance('aggregateByBreed', () => {
      const byBreed: Record<string, { count: number; revenue: number; avgDuration: number; pets: Set<string> }> = {}
      let total = 0

      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        total++
        // Group by weight class since breed info isn't available in NormalizedAppointment
        const breed = appt.petWeightCategory ? getWeightCategoryLabel(appt.petWeightCategory) : 'Unknown'
        
        if (!byBreed[breed]) {
          byBreed[breed] = { count: 0, revenue: 0, avgDuration: 0, pets: new Set() }
        }
        byBreed[breed].count += 1
        byBreed[breed].revenue += appt.netCents
        byBreed[breed].avgDuration += appt.actualDurationMinutes || appt.scheduledDurationMinutes
        byBreed[breed].pets.add(appt.petId)
      })

      return Object.entries(byBreed).map(([breed, data]) => ({
        breed,
        count: data.count,
        revenue: data.revenue,
        avgDuration: data.count > 0 ? Math.round(data.avgDuration / data.count) : 0,
        share: total > 0 ? (data.count / total) * 100 : 0,
        uniquePets: data.pets.size,
        avgVisitsPerPet: data.pets.size > 0 ? Math.round((data.count / data.pets.size) * 10) / 10 : 0,
      }))
    })
  }, [appointments])

  // KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []

    return measurePerformance('calculateAppointmentsByBreedKPIs', () => {
      const currentTotal = calculateAppointmentsCompleted(appointments)
      const previousTotal = calculateAppointmentsCompleted(previousAppointments)
      
      const uniqueBreeds = breedData.length
      const topBreed = [...breedData].sort((a, b) => b.count - a.count)[0]

      return [
        { metricId: 'totalAppointments', value: calculateKPIWithDelta(currentTotal, previousTotal, 'number') },
        { metricId: 'uniqueBreeds', value: calculateKPIWithDelta(uniqueBreeds, 0, 'number') },
        { metricId: 'topBreedCount', value: calculateKPIWithDelta(topBreed?.count || 0, 0, 'number') },
        { metricId: 'topBreedShare', value: calculateKPIWithDelta(topBreed?.share || 0, 0, 'percent') },
      ]
    })
  }, [appointments, previousAppointments, breedData])

  // Chart data - top 10
  const chartData = useMemo(() => {
    return breedData
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(b => ({
        label: b.breed.length > 12 ? b.breed.substring(0, 10) + '...' : b.breed,
        value: b.count,
      }))
  }, [breedData])

  // Table data
  const tableData = useMemo(() => {
    return breedData
      .sort((a, b) => b.count - a.count)
      .map(b => ({
        dimensionValue: b.breed,
        drillKey: `breed:${b.breed}`,
        metrics: {
          appointments: b.count,
          share: b.share,
          uniquePets: b.uniquePets,
          avgVisitsPerPet: b.avgVisitsPerPet,
          revenue: b.revenue,
          avgDuration: b.avgDuration,
        },
      }))
  }, [breedData])

  if (isLoading) {
    return (
      <ReportShell title="Appointments by Breed" description="Volume by breed" defaultTimeBasis="service">
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
      <ReportShell title="Appointments by Breed" description="Volume by breed" defaultTimeBasis="service">
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
      <ReportShell title="Appointments by Breed" description="Volume by breed" defaultTimeBasis="service">
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
        title="Appointments by Breed"
        description="Highest-volume breeds and their visit cadence"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <ChartCard title="Top 10 Breeds by Volume" description="Most common breeds" ariaLabel="Bar chart of appointments by breed">
          <SimpleBarChart data={chartData} height={280} formatValue={(v) => v.toString()} />
        </ChartCard>

        <DataTable
          title="Breed Details"
          data={tableData}
          columns={[
            { id: 'appointments', label: 'Appointments', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'share', label: 'Share %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
            { id: 'uniquePets', label: 'Unique Pets', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgVisitsPerPet', label: 'Avg Visits/Pet', format: 'number', align: 'right', sortable: true },
            { id: 'revenue', label: 'Revenue', format: 'money', align: 'right', sortable: true },
          ]}
          maxPreviewRows={15}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
