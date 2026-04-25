/**
 * Appointment Frequency & Retention Report
 * How often pets return and their lifetime value
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

export function AppointmentFrequencyRetention() {
  const { filters, setFilters } = useReportFilters()
  const { appointments, isLoading, error } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate frequency and retention by weight class + breed
  const retentionData = useMemo(() => {
    const byGroup: Record<string, { 
      pets: Map<string, { visits: number[]; spend: number }>
    }> = {}

    appointments.forEach(appt => {
      if (appt.status !== 'picked_up') return
      const weightClass = getWeightClass(appt.petWeight)
      const breed = appt.petBreed || 'Unknown'
      const key = `${weightClass}|${breed}`
      const petId = appt.petId || appt.clientId
      
      if (!byGroup[key]) {
        byGroup[key] = { pets: new Map() }
      }
      
      if (!byGroup[key].pets.has(petId)) {
        byGroup[key].pets.set(petId, { visits: [], spend: 0 })
      }
      
      const pet = byGroup[key].pets.get(petId)!
      pet.visits.push(new Date(appt.serviceDate).getTime())
      pet.spend += appt.netCents || 0
    })

    return Object.entries(byGroup).map(([key, data]) => {
      const [weightClass, breed] = key.split('|')
      const pets = Array.from(data.pets.values())
      
      const totalVisits = pets.reduce((sum, p) => sum + p.visits.length, 0)
      const totalSpend = pets.reduce((sum, p) => sum + p.spend, 0)
      const avgVisitsPerYear = pets.length > 0 ? (totalVisits / pets.length) * (365 / 90) : 0 // Rough estimate
      
      // Calculate retention days (avg days between visits)
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
        weightClass,
        breed,
        avgVisitsPerYear: Math.round(avgVisitsPerYear * 10) / 10,
        lifetimeSpend: Math.round(totalSpend / Math.max(pets.length, 1)),
        retentionDays,
        petCount: pets.length,
      }
    })
  }, [appointments])

  // KPIs
  const kpis = useMemo(() => {
    const totalPets = retentionData.reduce((sum, r) => sum + r.petCount, 0)
    const avgVisits = retentionData.length > 0 
      ? retentionData.reduce((sum, r) => sum + r.avgVisitsPerYear, 0) / retentionData.length 
      : 0
    const avgRetention = retentionData.length > 0 
      ? retentionData.reduce((sum, r) => sum + r.retentionDays, 0) / retentionData.length 
      : 0

    return [
      { metricId: 'totalPets', value: { current: totalPets, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'avgVisitsPerYear', value: { current: Math.round(avgVisits * 10) / 10, delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'avgRetentionDays', value: { current: Math.round(avgRetention), delta: 0, deltaPercent: 0, format: 'number' as const } },
      { metricId: 'uniqueGroups', value: { current: retentionData.length, delta: 0, deltaPercent: 0, format: 'number' as const } },
    ]
  }, [retentionData])

  // Table data
  const tableData = useMemo(() => {
    return retentionData
      .sort((a, b) => b.lifetimeSpend - a.lifetimeSpend)
      .map(r => ({
        dimensionValue: `${r.weightClass} - ${r.breed}`,
        drillKey: `group:${r.weightClass}:${r.breed}`,
        metrics: {
          avgVisitsPerYear: r.avgVisitsPerYear,
          lifetimeSpend: r.lifetimeSpend,
          retentionDays: r.retentionDays,
          petCount: r.petCount,
        },
      }))
  }, [retentionData])

  if (isLoading) {
    return (
      <ReportShell title="Appointment Frequency & Retention" description="Pet visit patterns" defaultTimeBasis="service">
        <Skeleton className="h-[400px]" />
      </ReportShell>
    )
  }

  if (error) {
    return (
      <ReportShell title="Appointment Frequency & Retention" description="Pet visit patterns" defaultTimeBasis="service">
        <Alert variant="destructive"><AlertDescription>Failed to load data.</AlertDescription></Alert>
        <Button onClick={() => window.location.reload()} className="mt-4"><ArrowsClockwise className="mr-2 h-4 w-4" /> Retry</Button>
      </ReportShell>
    )
  }

  if (appointments.length === 0) {
    return (
      <ReportShell title="Appointment Frequency & Retention" description="Pet visit patterns" defaultTimeBasis="service">
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
      <ReportShell title="Appointment Frequency & Retention" description="How often pets return and their lifetime value" defaultTimeBasis="service" onShowDefinitions={() => setShowDefinitions(true)}>
        <KPIDeck metrics={kpis} />
        <DataTable
          title="Weight Class / Breed Retention"
          data={tableData}
          columns={[
            { id: 'avgVisitsPerYear', label: 'Avg Visits/Yr', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'lifetimeSpend', label: 'Lifetime Spend', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'retentionDays', label: 'Retention Days', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'petCount', label: 'Pets', format: 'number', align: 'right', sortable: true },
          ]}
          maxPreviewRows={20}
          showViewAll
        />
      </ReportShell>
      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
