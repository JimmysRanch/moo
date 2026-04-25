/**
 * Breed Loyalty & Lifetime Value Report
 * Repeat behavior and ticket size by breed
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

export function BreedLoyaltyLifetimeValue() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate loyalty by breed
  const breedData = useMemo(() => {
    const byBreed: Record<string, { 
      pets: Map<string, { visits: number[]; spend: number }>
    }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const breed = appt.petBreed || 'Unknown'
      const petId = appt.petId || appt.clientId
      
      if (!byBreed[breed]) {
        byBreed[breed] = { pets: new Map() }
      }
      
      if (!byBreed[breed].pets.has(petId)) {
        byBreed[breed].pets.set(petId, { visits: [], spend: 0 })
      }
      
      const pet = byBreed[breed].pets.get(petId)!
      pet.visits.push(new Date(appt.serviceDate).getTime())
      pet.spend += appt.netCents || 0
    })

    return Object.entries(byBreed).map(([breed, data]) => {
      const pets = Array.from(data.pets.values())
      
      const totalVisits = pets.reduce((sum, p) => sum + p.visits.length, 0)
      const totalSpend = pets.reduce((sum, p) => sum + p.spend, 0)
      const avgVisitsPerYear = pets.length > 0 ? (totalVisits / pets.length) * (365 / 90) : 0
      const lifetimeSpend = pets.length > 0 ? Math.round(totalSpend / pets.length) : 0
      const avgTicket = totalVisits > 0 ? Math.round(totalSpend / totalVisits) : 0
      
      // Calculate retention days
      let totalDays = 0
      let intervalCount = 0
      pets.forEach(pet => {
        if (pet.visits.length > 1) {
          const sorted = pet.visits.sort((a, b) => a - b)
          for (let i = 1; i < sorted.length; i++) {
            totalDays += (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24)
            intervalCount++
          }
        }
      })
      const retentionDays = intervalCount > 0 ? Math.round(totalDays / intervalCount) : 0

      return {
        breed,
        avgVisitsPerYear: Math.round(avgVisitsPerYear * 10) / 10,
        lifetimeSpend,
        avgTicket,
        retentionDays,
        petCount: pets.length,
      }
    })
  }, [appointments])

  // KPIs
  const kpis = useMemo(() => {
    const topBreed = breedData.sort((a, b) => b.lifetimeSpend - a.lifetimeSpend)[0]
    const avgLTV = breedData.length > 0 
      ? Math.round(breedData.reduce((sum, b) => sum + b.lifetimeSpend, 0) / breedData.length)
      : 0

    return [
      { metricId: 'avgLTV', value: { current: avgLTV, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'topBreedLTV', value: { current: topBreed?.lifetimeSpend || 0, delta: 0, deltaPercent: 0, format: 'money' as const } },
      { metricId: 'uniqueBreeds', value: { current: breedData.length, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'totalPets', value: { current: breedData.reduce((sum, b) => sum + b.petCount, 0), delta: 0, deltaPercent: 0, format: 'number' as const } },
    ]
  }, [breedData])

  // Table data
  const tableData = useMemo(() => {
    return breedData
      .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend)
      .map(b => ({
        dimensionValue: b.breed,
        drillKey: `breed:${b.breed}`,
        metrics: {
          avgVisitsPerYear: b.avgVisitsPerYear,
          lifetimeSpend: b.lifetimeSpend,
          avgTicket: b.avgTicket,
          retentionDays: b.retentionDays,
          petCount: b.petCount,
        },
      }))
  }, [breedData])

  if (isLoading) {
    return (
      <ReportShell title="Breed Loyalty & Lifetime Value" description="Breed retention patterns" defaultTimeBasis="service">
        <Skeleton className="h-[400px]" />
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Breed Loyalty & Lifetime Value" description="Breed retention patterns" defaultTimeBasis="service">
        <Alert variant="destructive"><AlertDescription>Failed to load data.</AlertDescription></Alert>
        <Button onClick={() => window.location.reload()} className="mt-4"><ArrowsClockwise className="mr-2 h-4 w-4" /> Retry</Button>
      </ReportShell>
    )
  }

  if (appointments.length === 0) {
    return (
      <ReportShell title="Breed Loyalty & Lifetime Value" description="Breed retention patterns" defaultTimeBasis="service">
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
      <ReportShell title="Breed Loyalty & Lifetime Value" description="Repeat behavior and ticket size by breed" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <KPIDeck metrics={kpis} />
        <DataTable
          title="Breed Loyalty Details"
          data={tableData}
          columns={[
            { id: 'avgVisitsPerYear', label: 'Avg Visits/Yr', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'lifetimeSpend', label: 'Lifetime Spend', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgTicket', label: 'Avg Ticket', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'retentionDays', label: 'Retention Days', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'petCount', label: 'Pets', format: 'number', align: 'right', sortable: true },
          ]}
          maxPreviewRows={15}
          showViewAll
        />
      </ReportShell>
      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
