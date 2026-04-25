/**
 * Client Retention Report
 * Track customer retention and rebooking patterns
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
import { 
  calculateKPIWithDelta, 
  measurePerformance 
} from '../engine/analyticsEngine'

export function ClientRetention() {
  const { filters, setFilters } = useReportFilters()
  const { 
    appointments, 
    previousAppointments,
    isLoading, 
    error 
  } = useReportData(filters)
  const [showDefinitions, setShowDefinitions] = useState(false)

  // Calculate retention metrics
  const retentionData = useMemo(() => {
    return measurePerformance('calculateClientRetention', () => {
      const clientVisits: Record<string, { visits: number[]; totalSpend: number }> = {}
      
      appointments.filter(a => a.status === 'picked_up').forEach(appt => {
        if (!clientVisits[appt.clientId]) {
          clientVisits[appt.clientId] = { visits: [], totalSpend: 0 }
        }
        clientVisits[appt.clientId].visits.push(new Date(appt.serviceDate).getTime())
        clientVisits[appt.clientId].totalSpend += appt.netCents
      })

      // Calculate visit intervals and retention
      let totalClients = 0
      let returningClients = 0
      let avgVisitsPerClient = 0
      let avgDaysBetweenVisits = 0
      let intervalCount = 0

      Object.values(clientVisits).forEach(client => {
        totalClients++
        if (client.visits.length > 1) {
          returningClients++
          const sorted = client.visits.sort((a, b) => a - b)
          for (let i = 1; i < sorted.length; i++) {
            const days = (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24)
            avgDaysBetweenVisits += days
            intervalCount++
          }
        }
        avgVisitsPerClient += client.visits.length
      })

      avgVisitsPerClient = totalClients > 0 ? avgVisitsPerClient / totalClients : 0
      avgDaysBetweenVisits = intervalCount > 0 ? avgDaysBetweenVisits / intervalCount : 0
      const retentionRate = totalClients > 0 ? (returningClients / totalClients) * 100 : 0

      return {
        totalClients,
        returningClients,
        newClients: totalClients - returningClients,
        retentionRate,
        avgVisitsPerClient,
        avgDaysBetweenVisits,
        clientDetails: Object.entries(clientVisits).map(([clientId, data]) => {
          const appt = appointments.find(a => a.clientId === clientId)
          return {
            clientId,
            clientName: appt?.clientName || 'Unknown',
            visits: data.visits.length,
            totalSpend: data.totalSpend,
            avgSpend: data.visits.length > 0 ? Math.round(data.totalSpend / data.visits.length) : 0,
          }
        }),
      }
    })
  }, [appointments])

  // Calculate previous period metrics for comparison
  const previousRetentionData = useMemo(() => {
    return measurePerformance('calculatePreviousRetention', () => {
      const clientVisits: Record<string, number> = {}
      previousAppointments.filter(a => a.status === 'picked_up').forEach(appt => {
        clientVisits[appt.clientId] = (clientVisits[appt.clientId] || 0) + 1
      })
      const totalClients = Object.keys(clientVisits).length
      const returningClients = Object.values(clientVisits).filter(v => v > 1).length
      return {
        retentionRate: totalClients > 0 ? (returningClients / totalClients) * 100 : 0,
        returningClients,
        totalClients,
      }
    })
  }, [previousAppointments])

  // KPIs with period comparison
  const kpis = useMemo(() => {
    if (appointments.length === 0) return []
    
    return [
      { metricId: 'retentionRate', value: calculateKPIWithDelta(retentionData.retentionRate, previousRetentionData.retentionRate, 'percent') },
      { metricId: 'returningClients', value: calculateKPIWithDelta(retentionData.returningClients, previousRetentionData.returningClients, 'number') },
      { metricId: 'avgVisits', value: calculateKPIWithDelta(Math.round(retentionData.avgVisitsPerClient * 10) / 10, 0, 'number') },
      { metricId: 'avgDaysBetween', value: calculateKPIWithDelta(Math.round(retentionData.avgDaysBetweenVisits), 0, 'days') },
    ]
  }, [appointments.length, retentionData, previousRetentionData])

  // Table data
  const tableData = useMemo(() => {
    return retentionData.clientDetails
      .sort((a, b) => b.visits - a.visits)
      .map(c => ({
        dimensionValue: c.clientName,
        drillKey: `client:${c.clientId}`,
        metrics: {
          visits: c.visits,
          totalSpend: c.totalSpend,
          avgSpend: c.avgSpend,
          isReturning: c.visits > 1 ? 'Yes' : 'No',
        },
      }))
  }, [retentionData])

  if (isLoading) {
    return (
      <ReportShell title="Client Retention" description="Customer retention tracking" defaultTimeBasis="service">
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
      <ReportShell title="Client Retention" description="Customer retention tracking" defaultTimeBasis="service">
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
      <ReportShell title="Client Retention" description="Customer retention tracking" defaultTimeBasis="service">
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
        title="Client Retention"
        description="Track customer retention and rebooking patterns"
        defaultTimeBasis="service"
        onShowDefinitions={() => setShowDefinitions(true)}
      >
        <KPIDeck metrics={kpis} />

        <DataTable
          title="Client Visit History"
          data={tableData}
          columns={[
            { id: 'visits', label: 'Total Visits', format: 'number', align: 'right', defaultVisible: true, sortable: true },
            { id: 'totalSpend', label: 'Total Spend', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'avgSpend', label: 'Avg Spend', format: 'money', align: 'right', defaultVisible: true, sortable: true },
            { id: 'isReturning', label: 'Returning', format: 'text', align: 'center', sortable: true },
          ]}
          maxPreviewRows={15}
          showViewAll
        />
      </ReportShell>

      <DefinitionsModal open={showDefinitions} onClose={() => setShowDefinitions(false)} />
    </>
  )
}
