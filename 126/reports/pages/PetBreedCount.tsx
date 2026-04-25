/**
 * Pet Breed Count Report
 * Breeds on file with at least one active pet
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

export function PetBreedCount() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate breed counts
  const breedData = useMemo(() => {
    const byBreed: Record<string, Set<string>> = {}

    appointments.forEach(appt => {
      const breed = appt.petBreed || 'Unknown'
      const petId = appt.petId || `${appt.clientId}-pet`
      
      if (!byBreed[breed]) {
        byBreed[breed] = new Set()
      }
      byBreed[breed].add(petId)
    })

    const totalPets = Object.values(byBreed).reduce((sum, pets) => sum + pets.size, 0)

    return Object.entries(byBreed).map(([breed, pets]) => ({
      breed,
      petCount: pets.size,
      share: totalPets > 0 ? (pets.size / totalPets) * 100 : 0,
    }))
  }, [appointments])

  // KPIs
  const kpis = useMemo(() => {
    const totalPets = breedData.reduce((sum, b) => sum + b.petCount, 0)
    const uniqueBreeds = breedData.length
    const topBreed = breedData.sort((a, b) => b.petCount - a.petCount)[0]

    return [
      { metricId: 'totalPets', value: { current: totalPets, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'uniqueBreeds', value: { current: uniqueBreeds, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'topBreedCount', value: { current: topBreed?.petCount || 0, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'topBreedShare', value: { current: topBreed?.share || 0, delta: 0, deltaPercent: 0, format: 'percent' as const } },
    ]
  }, [breedData])

  // Chart data - top 10
  const chartData = useMemo(() => {
    return breedData
      .sort((a, b) => b.petCount - a.petCount)
      .slice(0, 10)
      .map(b => ({
        label: b.breed.length > 12 ? b.breed.substring(0, 10) + '...' : b.breed,
        value: b.petCount,
      }))
  }, [breedData])

  // Table data
  const tableData = useMemo(() => {
    return breedData
      .sort((a, b) => b.petCount - a.petCount)
      .map(b => ({
        dimensionValue: b.breed,
        drillKey: `breed:${b.breed}`,
        metrics: {
          petCount: b.petCount,
          share: b.share,
        },
      }))
  }, [breedData])

  if (isLoading) {
    return (
      <ReportShell title="Pet Breed Count" description="Breeds on file" defaultTimeBasis="service">
        <Skeleton className="h-[400px]" />
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Pet Breed Count" description="Breeds on file" defaultTimeBasis="service">
        <Alert variant="destructive"><AlertDescription>Failed to load data.</AlertDescription></Alert>
        <Button onClick={() => window.location.reload()} className="mt-4"><ArrowsClockwise className="mr-2 h-4 w-4" /> Retry</Button>
      </ReportShell>
    )
  }

  if (appointments.length === 0) {
    return (
      <ReportShell title="Pet Breed Count" description="Breeds on file" defaultTimeBasis="service">
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
      <ReportShell title="Pet Breed Count" description="Breeds on file with at least one active pet" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <KPIDeck metrics={kpis} />

        <ChartCard title="Top 10 Breeds" description="Most common breeds" ariaLabel="Bar chart of pet breeds">
          <SimpleBarChart data={chartData} height={280} formatValue={(v) => v.toString()} />
        </ChartCard>

        <DataTable
          title="All Breeds"
          data={tableData}
          columns={[
            { id: 'petCount', label: 'Pet Count', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'share', label: 'Share %', format: 'percent', align: 'right', defaultVisible: true, sortable: true },
          ]}
          maxPreviewRows={20}
          showViewAll
        />
      </ReportShell>
      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
